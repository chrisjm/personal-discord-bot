import * as dotenv from "dotenv";
dotenv.config();

import axios from "axios";
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { openaiProvider } from "./llms/providers/openai";
import { LLMUsageStats } from "../types/llm";
import { complete } from "./llms/utils/complete";
import { getChangeColor, formatDateHumanReadable } from "../utils";

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
    `https://newsapi.org/v2/top-headlines?pageSize=5&country=us&category=${category}&apiKey=${process.env.NEWS_API_KEY}`,
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
      publishedAt: article.publishedAt,
      url: article.url
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

For each article, provide:
1. A clear, concise title
2. A brief summary (2-5 sentences)
3. Sentiment score (0 to 1)
4. Key entities (people, organizations, locations)
5. Relevant emojis for the topic

Format each article as:
Title: [title]
Summary: [summary]
Sentiment: [score]
Entities: [entity1, entity2, ...]
Emojis: [emoji1 emoji2 ...]
Source: [source]
Date: [date]

Separate each article with "---"`;

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

export const data = new SlashCommandBuilder()
  .setName("news")
  .setDescription("Retrieve and summarize news from NewsAPI")
  .addStringOption((option) =>
    option
      .setName("category")
      .setDescription("News category")
      .setRequired(false)
      .addChoices(
        ...NEWS_CATEGORIES.map((category) => ({
          name: category,
          value: category,
        }))
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const category = (interaction.options.getString("category") as NewsCategory) || "general";

  try {
    const newsData = await getTopNews(category);

    if (!newsData.articles || newsData.articles.length === 0) {
      await interaction.editReply("No news articles found for the selected category.");
      return;
    }

    const summary = await summarizeNews(newsData.articles, interaction.user.id);
    const articles = summary.content.split("---").filter(article => article.trim());

    const embeds = articles.map((article, index) => {
      const lines = article.trim().split("\n");
      const fields: Record<string, string> = {};

      lines.forEach(line => {
        const [key, ...value] = line.split(": ");
        if (key && value.length > 0) {
          fields[key.toLowerCase()] = value.join(": ");
        }
      });

      const sentimentScore = parseFloat(fields.sentiment || "0.5");
      const color = getChangeColor(sentimentScore);

      const emojis = fields.emojis ? `${fields.emojis}` : '';
      const title = fields.title || "News Article";
      const source = fields.source || "Unknown";
      const date = formatDateHumanReadable(fields.date || new Date().toISOString());
      const url = newsData.articles[index].url;

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${emojis} ${title}`)
        .setURL(url)
        .addFields(
          { name: "Sentiment", value: fields.sentiment || "N/A", inline: true },
          { name: "Entities", value: fields.entities || "None", inline: true }
        )
        .setDescription(fields.summary || "No summary available")
        .setFooter({ text: `Source: ${source} • ${date}` });

      return embed;
    });

    // Send embeds in chunks of 10 (Discord's limit)
    for (let i = 0; i < embeds.length; i += 10) {
      const embedChunk = embeds.slice(i, i + 10);
      if (i === 0) {
        await interaction.editReply({ embeds: embedChunk });
      } else {
        await interaction.followUp({ embeds: embedChunk });
      }
    }

  } catch (error) {
    console.error("Error in news command:", error);
    await interaction.editReply("Sorry, there was an error while fetching the news.");
  }
}
