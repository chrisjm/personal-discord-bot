import { config } from "dotenv";
import { Client, Events } from "discord.js";
import * as reminderScheduler from "../utils/reminderScheduler";
import { waterReminderHandler } from "../handlers/waterReminder";
import { getAllRSSFeeds } from "../utils/rssDatabase";
import {
  addFeed,
  cleanup as cleanupRSSFeeds,
  displayAllUnprocessedItems,
} from "../utils/rssFeedHandler";

// Load environment variables
config();

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client: Client) {
    console.log(`Ready! Logged in as ${client.user?.tag}`);

    // Initialize RSS feeds
    try {
      const feeds = await getAllRSSFeeds();
      for (const feed of feeds) {
        await addFeed(
          feed.name,
          feed.url,
          feed.channelId,
          feed.updateFrequency,
          feed.data,
        );
      }
      console.log(`Initialized ${feeds.length} RSS feeds`);

      // Display any unprocessed items
      await displayAllUnprocessedItems(client);
    } catch (error) {
      console.error("Failed to initialize RSS feeds:", error);
    }

    // Initialize reminder scheduler
    reminderScheduler.setClient(client);
    reminderScheduler.registerHandler(waterReminderHandler);
    await reminderScheduler.initializeReminders();

    // Clean up on process exit
    process.on("SIGINT", () => {
      cleanupRSSFeeds();
      process.exit(0);
    });
  },
};
