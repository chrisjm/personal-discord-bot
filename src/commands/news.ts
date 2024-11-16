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
    `https://newsapi.org/v2/top-headlines?country=us&category=general&apiKey=${process.env.NEWS_API_KEY}`
  );
  const { data } = response;
  let articles: string[] = [];
  if (data.status === "ok") {
    articles = data.articles
      .filter(article => WHITELIST_SOURCES.includes(article.source.id?.toLowerCase() || ''))
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

export const data = new SlashCommandBuilder()
  .setName("news")
  .setDescription("Retrieve news from NewsAPI")
  .addStringOption((option) =>
    option
      .setName("action")
      .setDescription("What would you like to see?")
      .setRequired(true)
      .addChoices({ name: "top", value: "top" })
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (interaction.options.getString("action") === "top") {
    await interaction.deferReply();
    const result = await getTopNews();
    await interaction.editReply({
      content: result,
      components: [],
    });
  }
}
