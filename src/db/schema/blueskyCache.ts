import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const blueskyFeedCache = sqliteTable("bluesky_feed_cache", {
  id: integer("id").primaryKey(),
  record_uri: text("record_uri").notNull().unique(),
  fetched_at: integer("fetched_at").notNull(),
  content: text("content"),
  author_did: text("author_did"),
  author_handle: text("author_handle"),
  quote_of_uri: text("quote_of_uri"),
  quote_of_content: text("quote_of_content"),
  quote_author_did: text("quote_author_did"),
  quote_author_handle: text("quote_author_handle"),
});
