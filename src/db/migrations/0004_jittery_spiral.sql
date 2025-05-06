ALTER TABLE `bluesky_feed_cache` ADD `author_did` text;--> statement-breakpoint
ALTER TABLE `bluesky_feed_cache` ADD `author_handle` text;--> statement-breakpoint
ALTER TABLE `bluesky_feed_cache` ADD `repost_of_uri` text;--> statement-breakpoint
ALTER TABLE `bluesky_feed_cache` ADD `repost_of_content` text;--> statement-breakpoint
ALTER TABLE `bluesky_feed_cache` ADD `repost_author_did` text;--> statement-breakpoint
ALTER TABLE `bluesky_feed_cache` ADD `repost_author_handle` text;--> statement-breakpoint
ALTER TABLE `bluesky_feed_cache` DROP COLUMN `theme`;