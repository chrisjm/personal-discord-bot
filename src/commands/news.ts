import * as dotenv from "dotenv";
dotenv.config();

import axios from "axios";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { openaiProvider } from "./llms/providers/openai";
import { LLMUsageStats } from "../types/llm";
import { complete } from "./llms/utils/complete";

// Type definition for NewsAPI article
interface NewsArticle {
  source: {
    id: string | null;
    name: string;
  };
  title: string;
  description: string;
  url: string;
  publishedAt: string;
}

// Valid news categories
const NEWS_CATEGORIES = ['business', 'entertainment', 'general', 'health', 'science', 'sports', 'technology'] as const;
type NewsCategory = typeof NEWS_CATEGORIES[number];

async function getTopNews(category: NewsCategory = 'general') {
  const response = await axios.get<{
    status: string;
    articles: NewsArticle[];
  }>(
    `https://newsapi.org/v2/top-headlines?pageSize=10&country=us&category=${category}&apiKey=${process.env.NEWS_API_KEY}`,
  );
  const { data } = response;

  if (data.status === "ok") {
    const filteredArticles = data.articles;

    if (filteredArticles.length === 0) {
      return { text: "No articles found.", articles: [], stats: null };
    }

    // Prepare data for GPT summarization
    const articlesForSummary = filteredArticles.map(article => ({
      title: article.title,
      description: article.description,
      source: article.source.name,
      publishedAt: article.publishedAt
    }));

    return {
      articles: articlesForSummary,
    };
  } else {
    return { text: "There was an error retrieving news", articles: [], stats: null };
  }
}

async function summarizeNews(articles: any[], userId?: string): Promise<{ content: string; usage: LLMUsageStats }> {
  const prompt = `Analyze and summarize these news articles:

${JSON.stringify(articles, null, 2)}

Please provide a strictly factual summary of the key developments. Focus solely on main facts and events, avoiding editorial commentary or personal opinions. Keep the summaries concise.

1. **Sentiment Analysis:** Assess the overall sentiment of each article and assign a sentiment score (on a scale of 0 to 1). Indicate the sentiment with an accompanying colored dot: 🟢 for positive, ⚪️ for neutral, and 🔴 for negative.

2. **Entity Recognition:** Identify and list key entities (people, organizations, locations) mentioned in each article.

3. **Data Extraction:** Highlight relevant statistics or numerical data that support the news.

4. **Tagging:** Identify relevant tags for each article and present them as emojis in front of the title.

5. **Formatting:** Structure your response for Discord as follows:
   - Utilize bold formatting for important items.
   - Include the source name and the date and time of the article in parentheses.

**Example Output:**
📊✈️ **Short Title** (Sentiment: 0.8, 🟢)
**Key Entities:** Entity1, Entity2, Entity3
**Data Points:** Statistic1, Statistic2
1-3 sentence summary _(11/14/24 13:30)_

🚀🛰️ **Short Title** (Sentiment: 0.5, ⚪️)
**Key Entities:** Entity1, Entity2
**Data Points:** Statistic1
1-3 sentence summary _(11/13/24 11:00)_

🏥🦠 **Short Title** (Sentiment: 0.2, 🔴)
**Key Entities:** Entity1, Entity2, Entity3
**Data Points:** Statistic1, Statistic2
1-3 sentence summary _(11/12/24 10:00)_
`;
  try {
    const result = await complete(prompt, openaiProvider, {
      config: {
        model: "gpt-4o-mini",
        temperature: 0.1,
        maxTokens: 1000
      },
      userId,
      metadata: {
        command: "news",
        articleCount: articles.length
      }
    });
    return result;
  } catch (error) {
    console.error('Error getting summary:', error);
    throw error;
  }
}

// Constants for Discord limits
const DISCORD_MAX_LENGTH = 2000;

function chunkMessage(message: string, maxLength: number = DISCORD_MAX_LENGTH): string[] {
  if (message.length <= maxLength) return [message];

  const chunks: string[] = [];
  let remaining = message;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Find the last newline or space within the limit
    let splitIndex = remaining.lastIndexOf('\n', maxLength);
    if (splitIndex === -1 || splitIndex > maxLength) {
      splitIndex = remaining.lastIndexOf(' ', maxLength);
    }
    if (splitIndex === -1) splitIndex = maxLength;

    chunks.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex).trim();
  }

  // Add continuation markers
  return chunks.map((chunk, i) =>
    i < chunks.length - 1 ? `${chunk}\n_(continued...)_` : chunk
  );
}

export const data = new SlashCommandBuilder()
  .setName("news")
  .setDescription("Retrieve and summarize news from NewsAPI")
  .addStringOption((option) =>
    option
      .setName("category")
      .setDescription("News category to fetch")
      .setRequired(false)
      .addChoices(
        ...NEWS_CATEGORIES.map(category => ({
          name: category.charAt(0).toUpperCase() + category.slice(1),
          value: category
        }))
      )
  )

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const category = (interaction.options.getString("category") || "general") as NewsCategory;

  try {
    const newsResult = await getTopNews(category);

    // If we have articles, send the summary in chunks
    if (newsResult.articles.length > 0) {
      const { content: summary, usage } = await summarizeNews(newsResult.articles, interaction.user.id);
      const summaryChunks = chunkMessage(summary);

      // Send the first chunk with usage stats
      const usageStats = `\n\n_Cost: ~$${(usage.estimatedCost).toFixed(4)} (${usage.totalTokens} tokens)_`;
      await interaction.editReply(summaryChunks[0] + (summaryChunks.length === 1 ? usageStats : ''));

      // Send remaining chunks if any
      for (let i = 1; i < summaryChunks.length; i++) {
        const isLast = i === summaryChunks.length - 1;
        await interaction.followUp(summaryChunks[i] + (isLast ? usageStats : ''));
      }
    }
  } catch (error) {
    console.error("Error in news command:", error);
    await interaction.editReply("There was an error fetching the news. Please try again later.");
  }
}
