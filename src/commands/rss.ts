import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import {
  addFeed,
  stopUpdateInterval,
  getNewItems,
} from "../utils/rssFeedHandler";
import { getRSSFeed, getAllRSSFeeds, deleteFeed } from "../utils/rssDatabase";
import { config } from "dotenv";

// Load environment variables
config();

const DEFAULT_RSS_CHANNEL = process.env.DEFAULT_RSS_CHANNEL_ID;

export const data = new SlashCommandBuilder()
  .setName("rss")
  .setDescription("Manage RSS feeds")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("add")
      .setDescription("Add a new RSS feed")
      .addStringOption((option) =>
        option
          .setName("name")
          .setDescription("Unique name for this feed")
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName("url")
          .setDescription("URL of the RSS feed")
          .setRequired(true),
      )
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("Channel to post updates to (defaults to RSS channel)"),
      )
      .addIntegerOption((option) =>
        option
          .setName("frequency")
          .setDescription("Update frequency in minutes (default: 60)")
          .setMinValue(1)
          .setMaxValue(1440),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("list")
      .setDescription("List all RSS feeds"),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("remove")
      .setDescription("Remove an RSS feed")
      .addStringOption((option) =>
        option
          .setName("name")
          .setDescription("Name of the feed to remove")
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("force-update")
      .setDescription("Force update a feed")
      .addStringOption((option) =>
        option
          .setName("name")
          .setDescription("Name of the feed to update")
          .setRequired(true),
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case "add": {
      await interaction.deferReply();
      
      const name = interaction.options.getString("name", true);
      const url = interaction.options.getString("url", true);
      const channel = interaction.options.getChannel("channel");
      const frequencyMinutes = interaction.options.getInteger("frequency") || 60;

      try {
        const existingFeed = await getRSSFeed(name);
        if (existingFeed) {
          await interaction.editReply(`A feed with the name "${name}" already exists.`);
          return;
        }

        // Use default channel if none specified
        const channelId = channel?.id || DEFAULT_RSS_CHANNEL;
        if (!channelId) {
          await interaction.editReply("No channel specified and no default RSS channel configured. Please specify a channel or set DEFAULT_RSS_CHANNEL_ID in your environment.");
          return;
        }

        await addFeed(
          name,
          url,
          channelId,
          frequencyMinutes * 60, // Convert minutes to seconds
        );

        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle("RSS Feed Added")
          .addFields(
            { name: "Name", value: name, inline: true },
            { name: "URL", value: url, inline: true },
            { name: "Channel", value: `<#${channelId}>`, inline: true },
            { name: "Update Frequency", value: `${frequencyMinutes} minutes`, inline: true },
          );

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        await interaction.editReply(`Failed to add RSS feed: ${error.message}`);
      }
      break;
    }

    case "list": {
      await interaction.deferReply();

      try {
        const feeds = await getAllRSSFeeds();
        
        if (feeds.length === 0) {
          await interaction.editReply("No RSS feeds configured.");
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle("RSS Feeds")
          .addFields(
            feeds.map((feed) => ({
              name: feed.name,
              value: `URL: ${feed.url}\nChannel: <#${feed.channelId}>\nFrequency: ${Math.floor(feed.updateFrequency / 60)} minutes`,
              inline: false,
            })),
          );

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        await interaction.editReply("Failed to list RSS feeds.");
      }
      break;
    }

    case "remove": {
      await interaction.deferReply();

      const name = interaction.options.getString("name", true);

      try {
        const feed = await getRSSFeed(name);
        if (!feed) {
          await interaction.editReply(`No feed found with the name "${name}".`);
          return;
        }

        stopUpdateInterval(name);
        await deleteFeed(name);
        
        await interaction.editReply(`Removed RSS feed "${name}".`);
      } catch (error) {
        await interaction.editReply(`Failed to remove RSS feed: ${error.message}`);
      }
      break;
    }

    case "force-update": {
      await interaction.deferReply();

      const name = interaction.options.getString("name", true);

      try {
        const feed = await getRSSFeed(name);
        if (!feed) {
          await interaction.editReply(`No feed found with the name "${name}".`);
          return;
        }

        const items = await getNewItems(name);
        await interaction.editReply(
          `Force updated "${name}". Found ${items.length} new items.`,
        );
      } catch (error) {
        await interaction.editReply(`Failed to force update: ${error.message}`);
      }
      break;
    }
  }
}
