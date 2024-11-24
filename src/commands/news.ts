import * as dotenv from "dotenv";
dotenv.config();

import axios from "axios";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

// Type definition for NewsAPI article
interface NewsArticle {
  source: {
    id: string | null;
    name: string;
  };
  title: string;
  url: string;
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

async function getTopNews() {
  const response = await axios.get<{
    status: string;
    articles: NewsArticle[];
  }>(
    `https://newsapi.org/v2/top-headlines?country=us&category=general&apiKey=${process.env.NEWS_API_KEY}`,
  );
  const { data } = response;
  let articles: string[] = [];
  if (data.status === "ok") {
    articles = data.articles
      .filter((article) =>
        WHITELIST_SOURCES.includes(article.source.id?.toLowerCase() || ""),
      )
      .map((article) => {
        return `* [${article.title}](${article.url}) - ${article.source.name}`;
      });
    return articles.length > 0
      ? articles.join("\n")
      : "No articles found from whitelisted sources.";
  } else {
    return "There was an error retrieving news";
  }
}

async function getYesterdayNews() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const formattedDate = yesterday.toISOString().split("T")[0];

  let articles: string[] = [];
  let page = 1;

  while (articles.length < 10 && page <= 1) {
    const response = await axios.get<{
      status: string;
      articles: NewsArticle[];
    }>(
      `https://newsapi.org/v2/everything?q=general&from=${formattedDate}&to=${formattedDate}&language=en&sortBy=popularity&apiKey=${process.env.NEWS_API_KEY}&pageSize=100&page=${page}`,
    );
    const { data } = response;

    if (data.status === "ok") {
      const filteredArticles = data.articles
        .filter((article) =>
          WHITELIST_SOURCES.includes(article.source.id || ""),
        )
        .map((article) => `${article.title} - ${article.url}`);

      articles.push(...filteredArticles);
      if (filteredArticles.length === 0) break; // No more articles from whitelisted sources
    } else {
      break; // API error, stop trying
    }

    page++;
  }

  articles = articles.slice(0, 10); // Ensure we only return max 10 articles
  return articles.length > 0
    ? articles.join("\n\n")
    : "No news articles found from yesterday.";
}

export const data = new SlashCommandBuilder()
  .setName("news")
  .setDescription("Retrieve news from NewsAPI")
  .addStringOption((option) =>
    option
      .setName("action")
      .setDescription("What would you like to see?")
      .setRequired(true)
      .addChoices(
        { name: "top", value: "top" },
        { name: "yesterday", value: "yesterday" },
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const action = interaction.options.getString("action");
  await interaction.deferReply();

  let result: string;
  if (action === "top") {
    result = await getTopNews();
  } else if (action === "yesterday") {
    result = await getYesterdayNews();
  } else {
    result = "Invalid action specified";
  }

  await interaction.editReply({
    content: result,
    components: [],
  });
}
