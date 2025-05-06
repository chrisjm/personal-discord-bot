ALTER TABLE `bluesky_feed_cache` RENAME COLUMN "repost_of_uri" TO "quote_of_uri";--> statement-breakpoint
ALTER TABLE `bluesky_feed_cache` RENAME COLUMN "repost_of_content" TO "quote_of_content";--> statement-breakpoint
ALTER TABLE `bluesky_feed_cache` RENAME COLUMN "repost_author_did" TO "quote_author_did";--> statement-breakpoint
ALTER TABLE `bluesky_feed_cache` RENAME COLUMN "repost_author_handle" TO "quote_author_handle";