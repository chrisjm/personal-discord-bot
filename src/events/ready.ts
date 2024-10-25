import { Client, Events, TextChannel } from "discord.js";
import {
  displayNewEntries,
  fetchRSSFeed,
  storeNewEntries,
} from "../news-minimalist";

export default {
  name: Events.ClientReady,
  once: true,
  execute(client: Client) {
    console.log(`🟢 Ready! Logged in as ${client.user?.tag}`);

    const channel = client.channels.cache.get(
      process.env.NEWS_MINIMALIST_DISCORD_CHANNEL_ID
    ) as TextChannel;

    // Fetch RSS feed and display new entries every hour
    setInterval(async () => {
      const items = await fetchRSSFeed(
        process.env.NEWS_MINIMALIST_RSS_FEED_URL
      );
      if (items.length > 0) {
        await storeNewEntries(items);
        displayNewEntries(channel);
      }
    }, 30 * 60 * 1000); // Run every 30 min
  },
};
