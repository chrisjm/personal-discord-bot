import { text, integer, sqliteTable } from "drizzle-orm/sqlite-core";

export const rssFeeds = sqliteTable("rss_feeds", {
  id: text("id").primaryKey(),
  url: text("url").notNull(),
  channelId: text("channel_id").notNull(),
  lastChecked: integer("last_checked").notNull(),
  lastItemGuid: text("last_item_guid"),
});
