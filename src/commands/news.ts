import * as dotenv from "dotenv";
dotenv.config();

import axios from "axios";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

async function getTopNews() {
  const response = await axios.get(
    `https://newsapi.org/v2/top-headlines?country=us&pageSize=5&category=general&apiKey=${process.env.NEWS_API_KEY}`
  );
  const { data } = response;
  let articles = [];
  if (data.status === "ok") {
    articles = data.articles.map((article) => {
      return `* [${article.title}](${article.url})`;
    });
    return articles.join("\n");
  } else {
    return "There was an error";
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
