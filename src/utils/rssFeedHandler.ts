import Parser from "rss-parser";
import {
  RSSItem,
  setRSSFeed,
  getRSSFeed,
  addRSSItems,
  updateLastUpdateTime,
  getUnprocessedItems,
  markItemsAsProcessed,
  getAllRSSFeeds,
} from "./rssDatabase";
import { Client, TextChannel } from "discord.js";
import { displayNewEntries } from "./rssDisplay";

const parser = new Parser();

// Store intervals globally
const updateIntervals: Map<string, NodeJS.Timeout> = new Map();

// Initialize a new RSS feed
export async function addFeed(
  name: string,
  url: string,
  channelId: string,
  updateFrequency: number = 3600,
  data?: string,
): Promise<void> {
  try {
    // Validate the feed URL by attempting to parse it
    await parser.parseURL(url);

    // Store the feed in the database
    await setRSSFeed({
      name,
      url,
      channelId,
      updateFrequency,
      data,
    });

    // Start the update interval
    await startUpdateInterval(name);
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(`Failed to add RSS feed: ${error.message}`);
    }
    throw new Error(`Failed to add RSS feed: ${String(error)}`);
  }
}

// Start the update interval for a feed
async function startUpdateInterval(feedName: string): Promise<void> {
  // Clear any existing interval
  stopUpdateInterval(feedName);

  const feed = await getRSSFeed(feedName);
  if (!feed) return;

  // Create new interval
  const interval = setInterval(
    () => updateFeed(feedName),
    (feed?.updateFrequency || 3600) * 1000, // Convert seconds to milliseconds
  );

  updateIntervals.set(feedName, interval);

  // Perform initial update
  await updateFeed(feedName);
}

// Stop the update interval for a feed
export function stopUpdateInterval(feedName: string): void {
  const interval = updateIntervals.get(feedName);
  if (interval) {
    clearInterval(interval);
    updateIntervals.delete(feedName);
  }
}

// Update a feed and display new items
export async function updateFeed(feedName: string, client?: Client): Promise<void> {
  try {
    const feed = await getRSSFeed(feedName);
    if (!feed) return;

    const parsedFeed = await parser.parseURL(feed.url);

    // Convert parsed items to our format
    const items: RSSItem[] = parsedFeed.items.map((item) => ({
      feedName,
      guid: item.guid || item.id || item.link || "",
      title: item.title || "",
      link: item.link || "",
      pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
      content: item.content || item.contentSnippet || "",
      processed: false,
    }));

    // Store items in database
    await addRSSItems(items);
    await updateLastUpdateTime(feedName);

    // Display new items if client is provided
    if (client) {
      await displayNewItems(feedName, feed.channelId, client);
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(`Failed to update RSS feed ${feedName}: ${error.message}`);
    } else {
      console.error(`Failed to update RSS feed ${feedName}: ${String(error)}`);
    }
  }
}

// Get unprocessed items for a feed
export async function getNewItems(feedName: string): Promise<RSSItem[]> {
  return await getUnprocessedItems(feedName);
}

// Display new items and mark them as processed
export async function displayNewItems(
  feedName: string,
  channelId: string,
  client: Client,
): Promise<void> {
  try {
    // Get unprocessed items
    const items = await getUnprocessedItems(feedName);
    if (items.length === 0) return;

    // Get the channel
    const channel = client.channels.cache.get(channelId) as TextChannel;
    if (!channel) {
      console.error(`Channel ${channelId} not found for feed ${feedName}`);
      return;
    }

    // Get feed info for source name
    const feed = await getRSSFeed(feedName);
    if (!feed) return;

    // Display the items
    await displayNewEntries(channel, items, feed.name);

    // Mark items as processed
    await markItemsAsProcessed(
      feedName,
      items.map((item) => item.guid),
    );
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(`Failed to display items for feed ${feedName}: ${error.message}`);
    } else {
      console.error(`Failed to display items for feed ${feedName}: ${String(error)}`);
    }
  }
}

// Display all unprocessed items for all feeds
export async function displayAllUnprocessedItems(client: Client): Promise<void> {
  try {
    const feeds = await getAllRSSFeeds();
    for (const feed of feeds) {
      await displayNewItems(feed.name, feed.channelId, client);
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Failed to display unprocessed items: ${error.message}");
    } else {
      console.error("Failed to display unprocessed items: ${String(error)}");
    }
  }
}

// Clean up all intervals
export function cleanup(): void {
  for (const [feedName] of updateIntervals) {
    stopUpdateInterval(feedName);
  }
}
