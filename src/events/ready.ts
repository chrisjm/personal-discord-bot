import { Client, Events, TextChannel } from "discord.js";
import {
  displayNewEntries,
  fetchRSSFeed,
  storeNewEntries,
} from "../news-minimalist";
import { formatDate } from "../utils";

function refreshNewsMinimalist(client: Client) {
  const channel = client.channels.cache.get(
    process.env.NEWS_MINIMALIST_DISCORD_CHANNEL_ID
  ) as TextChannel;

  // Run once to update on startup
  processRSSFeed(channel);

  // Run every 10 minutes while running
  setInterval(async () => {
    processRSSFeed(channel);
  }, 10 * 60 * 1000);
}

async function processRSSFeed(channel: TextChannel) {
  const items = await fetchRSSFeed(process.env.NEWS_MINIMALIST_RSS_FEED_URL);
  console.log(
    `${formatDate(new Date())} Fetched ${items.length} entries from ${
      process.env.NEWS_MINIMALIST_RSS_FEED_URL
    }`
  );
  if (items.length > 0) {
    await storeNewEntries(items);
    displayNewEntries(channel);
  }
}

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client: Client) {
    console.log(`🟢 Ready! Logged in as ${client.user?.tag}`);

    try {
      // NOTE: Nothing more than email newsletter update
      // refreshNewsMinimalist(client);
    } catch (error) {
      console.error(error);
    }
  },
};
