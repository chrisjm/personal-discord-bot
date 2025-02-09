import { text, integer, sqliteTable, primaryKey } from "drizzle-orm/sqlite-core";

export const rssFeeds = sqliteTable("rss_feeds", {
  name: text("name").primaryKey(),
  url: text("url").notNull(),
  channelId: text("channel_id").notNull(),
  updateFrequency: integer("update_frequency").notNull().default(3600),
  lastUpdate: integer("last_update").notNull().default(0),
  data: text("data"),
});

export const rssItems = sqliteTable("rss_items", {
  feedName: text("feed_name").notNull().references(() => rssFeeds.name),
  guid: text("guid").notNull(),
  title: text("title").notNull(),
  link: text("link").notNull(),
  pubDate: text("pub_date").notNull(),
  content: text("content").notNull(),
  processed: integer("processed").notNull().default(0),
}, (table) => ({
  pk: primaryKey({ columns: [table.feedName, table.guid] })
}));
