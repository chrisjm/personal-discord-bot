import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const blueskyFeedCache = sqliteTable("bluesky_feed_cache", {
  id: integer('id').primaryKey(),
  record_uri: text('record_uri').notNull().unique(),
  fetched_at: integer('fetched_at').notNull(),
  content: text('content'),
  author_did: text('author_did'),
  author_handle: text('author_handle'),
  repost_of_uri: text('repost_of_uri'),
  repost_of_content: text('repost_of_content'),
  repost_author_did: text('repost_author_did'),
  repost_author_handle: text('repost_author_handle'),
});
