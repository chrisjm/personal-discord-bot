import * as dotenv from "dotenv";
dotenv.config();

import axios from "axios";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { complete } from "./llms/providers/openai";

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

// Whitelist of allowed news sources
const WHITELIST_SOURCES = [
  "bbc-news",
  "abc-news",
  "npr",
  "cbc-news",
  "fox-news",
  "reuters",
  "associated-press",
  "new-scientist",
  "the-wall-street-journal",
];

// Valid news categories
const NEWS_CATEGORIES = ['business', 'entertainment', 'general', 'health', 'science', 'sports', 'technology'] as const;
type NewsCategory = typeof NEWS_CATEGORIES[number];

async function getTopNews(category: NewsCategory = 'general') {
  const response = await axios.get<{
    status: string;
    articles: NewsArticle[];
  }>(
    `https://newsapi.org/v2/top-headlines?country=us&category=${category}&apiKey=${process.env.NEWS_API_KEY}`,
  );
  const { data } = response;

  if (data.status === "ok") {
    const filteredArticles = data.articles
      .filter((article) =>
        WHITELIST_SOURCES.includes(article.source.id?.toLowerCase() || ""),
      );

    if (filteredArticles.length === 0) {
      return { text: "No articles found from whitelisted sources.", articles: [] };
    }

    // Format articles for display
    const formattedText = filteredArticles
      .map((article) => {
        const date = new Date(article.publishedAt);
        const formattedDate = date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
        return `* **${article.title}** ${formattedDate}`;
      })
      .join("\n");

    // Prepare data for GPT summarization
    const articlesForSummary = filteredArticles.map(article => ({
      title: article.title,
      description: article.description,
      source: article.source.name,
      publishedAt: article.publishedAt
    }));

    return {
      text: formattedText,
      articles: articlesForSummary
    };
  } else {
    return { text: "There was an error retrieving news", articles: [] };
  }
}

async function summarizeNews(articles: any[]) {
  const prompt = `Here are the latest news articles:

${JSON.stringify(articles, null, 2)}

Please provide a concise summary of these news articles, highlighting the most important developments and common themes. Format the response in a clear and engaging way in paragraph form. Must keep it under 1500 characters in length. Format for Discord and bold important items.`;

  try {
    const result = await complete(prompt, {
      model: "gpt-4o",
      temperature: 0.25,
      maxTokens: 500
    });
    return result.content;
  } catch (error) {
    console.error('Error getting summary:', error);
    return 'Unable to generate summary at this time.';
  }
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
  .addBooleanOption((option) =>
    option
      .setName("summarize")
      .setDescription("Get an AI-generated summary of the news")
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const category = (interaction.options.getString("category") || "general") as NewsCategory;
  const shouldSummarize = interaction.options.getBoolean("summarize") || false;

  try {
    const newsResult = await getTopNews(category);
    const header = `**${category.charAt(0).toUpperCase() + category.slice(1)} News** (${newsResult.articles.length} stories)`;

    // Send first message with articles
    await interaction.editReply(`${header}\n${newsResult.text}`);

    // If summarize is requested and we have articles, send a second message with the summary
    if (shouldSummarize && newsResult.articles.length > 0) {
      const summary = await summarizeNews(newsResult.articles);
      await interaction.followUp(`**Summary:**\n${summary}`);
    }
  } catch (error) {
    console.error("Error in news command:", error);
    await interaction.editReply("There was an error retrieving the news.");
  }
}
