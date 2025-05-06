import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const blueskyFeedCache = sqliteTable("bluesky_feed_cache", {
  id: integer('id').primaryKey(),
  record_uri: text('record_uri').notNull().unique(),
  fetched_at: integer('fetched_at').notNull(),
  // add columns for theme or summary if needed
  theme: text('theme'),
  content: text('content'),
});
