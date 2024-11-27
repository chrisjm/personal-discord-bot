import * as dotenv from "dotenv";
dotenv.config();

import axios from "axios";
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { openaiProvider } from "./llms/providers/openai";
import { LLMUsageStats } from "../types/llm";
import { complete } from "./llms/utils/complete";
import { getChangeColor, formatDateHumanReadable } from "../utils";
import { addNewsArticle, addNewsAnalysis, getUnshownArticles, getNewsAnalysis, markArticlesAsShown, NewsAnalysis, getNewsArticle } from "../utils/newsDatabase";

// Type definition for NewsAPI article
interface NewsAPINewsArticle {
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
  // Get fresh articles from NewsAPI
  const response = await axios.get<{
    status: string;
    articles: NewsAPINewsArticle[];
  }>(
    `https://newsapi.org/v2/top-headlines?pageSize=20&country=us&category=${category}&apiKey=${process.env.NEWS_API_KEY}`,
  );
  const { data } = response;

  if (data.status !== "ok" || !data.articles?.length) {
    return { text: "No articles found.", articles: [], stats: null };
  }

  // Save all articles to database, preserving shown status for existing articles
  const articlesWithGuids = await Promise.all(data.articles.map(async article => {
    const guid = article.url; // Using URL as GUID

    // Check if article already exists
    const existingArticle = await getNewsArticle(guid);
    const hasBeenShown = existingArticle ? existingArticle.hasBeenShown : false;

    await addNewsArticle({
      guid,
      title: article.title,
      description: article.description,
      url: article.url,
      sourceName: article.source.name,
      sourceId: article.source.id,
      publishedAt: article.publishedAt,
      category,
      hasBeenShown
    });
    return {
      ...article,
      guid
    };
  }));

  // Get list of unshown articles to filter out already shown ones
  const unshownArticles = await getUnshownArticles(category);
  const unshownGuids = new Set(unshownArticles.map(a => a.guid));

  // Filter to only unshown articles
  const newArticles = articlesWithGuids.filter(article => unshownGuids.has(article.guid));

  if (newArticles.length === 0) {
    return { text: "No new articles to show.", articles: [], stats: null };
  }

  // Prepare data for GPT summarization
  const articlesForSummary = newArticles.map(article => ({
    title: article.title,
    description: article.description,
    source: article.source.name,
    publishedAt: article.publishedAt,
    url: article.url,
    guid: article.guid
  }));

  return {
    articles: articlesForSummary,
  };
}

async function summarizeNews(articles: any[], userId?: string): Promise<{ content: string; usage: LLMUsageStats }> {
  // Handle case when there are no articles to process
  if (!articles || articles.length === 0) {
    return {
      content: "No new articles to summarize at this time.",
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCost: 0
      }
    };
  }

  // Check which articles already have analysis
  const articlesNeedingAnalysis: any[] = [];
  const cachedAnalyses: { [guid: string]: NewsAnalysis } = {};
  let result;

  for (const article of articles) {
    const analysis = await getNewsAnalysis(article.guid);
    if (analysis) {
      cachedAnalyses[article.guid] = analysis;
    } else {
      articlesNeedingAnalysis.push(article);
    }
  }

  let newAnalyses: { [guid: string]: NewsAnalysis } = {};

  // Only call GPT for articles that need analysis
  if (articlesNeedingAnalysis.length > 0) {
    const prompt = `Analyze and summarize these news articles:

${JSON.stringify(articlesNeedingAnalysis, null, 2)}

For each article, analyze the content and provide a JSON array containing objects with the following structure:
{
  "guid": string,           // The article's guid from the input
  "summary": string,        // 2-5 sentence factual summary
  "sentimentScore": number, // Score from 0 to 1
  "entities": string[],     // List of key people, organizations, locations
  "emojis": string[]       // List of relevant emojis
}

Focus solely on main facts and events, avoiding editorial commentary or personal opinions.
Keep the summaries concise and factual.

IMPORTANT: Return ONLY the JSON array, with no additional text or formatting.
Example response format:
[
  {
    "guid": "https://example.com/article1",
    "summary": "SpaceX successfully launched 60 Starlink satellites...",
    "sentimentScore": 0.8,
    "entities": ["SpaceX", "Elon Musk", "Cape Canaveral"],
    "emojis": ["🚀", "🛰️", "✨"]
  }
]`;
    try {
      result = await complete(prompt, openaiProvider, {
        config: {
          model: "gpt-4o-mini",
          temperature: 0.1,
          maxTokens: 1000
        },
        userId,
        metadata: {
          command: "news",
          articleCount: articlesNeedingAnalysis.length
        }
      });

      // Parse the JSON response
      let analyses: NewsAnalysis[];
      try {
        analyses = JSON.parse(result.content);
      } catch (error) {
        console.error('Error parsing GPT response as JSON:', error);
        console.error('Raw response:', result.content);
        throw new Error('Failed to parse news analysis response');
      }

      // Cache the analyses
      for (const analysis of analyses) {
        await addNewsAnalysis(analysis);
        newAnalyses[analysis.guid] = analysis;
      }

      // Store the result for usage stats
      result.usage.estimatedCost = result.usage.estimatedCost || 0;
      result.usage.promptTokens = result.usage.promptTokens || 0;
      result.usage.completionTokens = result.usage.completionTokens || 0;
      result.usage.totalTokens = result.usage.totalTokens || 0;
    } catch (error) {
      console.error('Error getting summary:', error);
      throw error;
    }
  }

  // Combine cached and new analyses
  const allAnalyses = { ...cachedAnalyses, ...newAnalyses };

  // Format the final output using all analyses
  const content = articles.map(article => {
    const analysis = allAnalyses[article.guid];
    return `Title: ${article.title}
Summary: ${analysis.summary}
Sentiment: ${analysis.sentimentScore}
Entities: ${analysis.entities.join(", ")}
Emojis: ${analysis.emojis.join(" ")}
Source: ${article.source}
Date: ${article.publishedAt}
---`;
  }).join("\n");

  // Mark all articles as shown after successful processing
  await markArticlesAsShown(articles.map(a => a.guid));

  // If we used cached analyses only, return zero usage
  if (articlesNeedingAnalysis.length === 0) {
    return {
      content,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCost: 0
      }
    };
  }

  // If new analyses were generated, return the usage from the result
  return {
    content,
    usage: result ? result.usage : {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCost: 0
    }
  };
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

    // Send the embeds in chunks of 10 (Discord's limit)
    for (let i = 0; i < embeds.length; i += 10) {
      const embedChunk = embeds.slice(i, i + 10);
      if (i === 0) {
        await interaction.editReply({ embeds: embedChunk });
      } else {
        await interaction.followUp({ embeds: embedChunk });
      }
    }

    // Mark articles as shown after successfully sending them
    await markArticlesAsShown(newsData.articles.map(article => article.guid));

  } catch (error) {
    console.error("Error in news command:", error);
    await interaction.editReply("An error occurred while fetching or processing the news.");
  }
}
