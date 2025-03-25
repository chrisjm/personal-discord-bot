import { eq, and, sql, inArray } from "drizzle-orm";
import { db } from "../db";
import { rssFeeds, rssItems } from "../db/schema/rss";

export interface RSSFeed {
  name: string;
  url: string;
  channelId: string;
  updateFrequency?: number;
  data?: string;
}

export interface RSSItem {
  feedName: string;
  guid: string;
  title: string;
  link: string;
  pubDate: string;
  content: string;
  processed: boolean;
}

// Add or update an RSS feed
export async function setRSSFeed(feed: RSSFeed): Promise<void> {
  await db
    .insert(rssFeeds)
    .values({
      name: feed.name,
      url: feed.url,
      channelId: feed.channelId,
      updateFrequency: feed.updateFrequency || 3600,
      data: feed.data || null,
      lastUpdate: 0,
    })
    .onConflictDoUpdate({
      target: rssFeeds.name,
      set: {
        url: feed.url,
        channelId: feed.channelId,
        updateFrequency: feed.updateFrequency || 3600,
        data: feed.data || null,
      },
    });
}

// Get an RSS feed by name
export async function getRSSFeed(name: string): Promise<RSSFeed | null> {
  const result = await db
    .select()
    .from(rssFeeds)
    .where(eq(rssFeeds.name, name));
  if (result.length === 0) return null;

  const feed = result[0];
  return {
    name: feed.name,
    url: feed.url,
    channelId: feed.channelId,
    updateFrequency: feed.updateFrequency,
    data: feed.data || undefined,
  };
}

// Get all RSS feeds
export async function getAllRSSFeeds(): Promise<RSSFeed[]> {
  const feeds = await db.select().from(rssFeeds);
  return feeds.map((feed) => ({
    name: feed.name,
    url: feed.url,
    channelId: feed.channelId,
    updateFrequency: feed.updateFrequency,
    data: feed.data || undefined,
  }));
}

// Add RSS items
export async function addRSSItems(items: RSSItem[]): Promise<void> {
  await db
    .insert(rssItems)
    .values(
      items.map((item) => ({
        feedName: item.feedName,
        guid: item.guid,
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        content: item.content,
        processed: item.processed ? 1 : 0,
      })),
    )
    .onConflictDoUpdate({
      target: [rssItems.feedName, rssItems.guid],
      set: {
        title: sql`excluded.title`,
        link: sql`excluded.link`,
        pubDate: sql`excluded.pub_date`,
        content: sql`excluded.content`,
        processed: sql`excluded.processed`,
      },
    });
}

// Get unprocessed items for a feed
export async function getUnprocessedItems(
  feedName: string,
): Promise<RSSItem[]> {
  const items = await db
    .select()
    .from(rssItems)
    .where(and(eq(rssItems.feedName, feedName), eq(rssItems.processed, 0)));

  return items.map((item) => ({
    feedName: item.feedName,
    guid: item.guid,
    title: item.title,
    link: item.link,
    pubDate: item.pubDate,
    content: item.content,
    processed: Boolean(item.processed),
  }));
}

// Mark items as processed
export async function markItemsAsProcessed(
  feedName: string,
  guids: string[],
): Promise<void> {
  await db
    .update(rssItems)
    .set({ processed: 1 })
    .where(and(eq(rssItems.feedName, feedName), inArray(rssItems.guid, guids)));
}

// Update last update time for a feed
export async function updateLastUpdateTime(feedName: string): Promise<void> {
  await db
    .update(rssFeeds)
    .set({ lastUpdate: Math.floor(Date.now() / 1000) })
    .where(eq(rssFeeds.name, feedName));
}

// Delete a feed and its items
export async function deleteFeed(name: string): Promise<void> {
  // Delete all items for this feed first
  await db.delete(rssItems).where(eq(rssItems.feedName, name));

  // Delete the feed itself
  await db.delete(rssFeeds).where(eq(rssFeeds.name, name));
}
