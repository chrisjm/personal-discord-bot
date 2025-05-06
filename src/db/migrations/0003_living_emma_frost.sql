CREATE TABLE `bluesky_feed_cache` (
	`id` integer PRIMARY KEY NOT NULL,
	`record_uri` text NOT NULL,
	`fetched_at` integer NOT NULL,
	`theme` text,
	`content` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bluesky_feed_cache_record_uri_unique` ON `bluesky_feed_cache` (`record_uri`);--> statement-breakpoint
CREATE TABLE `streaks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`streak_type` text NOT NULL,
	`current_streak` integer DEFAULT 0 NOT NULL,
	`longest_streak` integer DEFAULT 0 NOT NULL,
	`last_updated` integer NOT NULL,
	`protection_used` integer DEFAULT 0 NOT NULL,
	`last_protection_used` integer,
	`streak_level` text DEFAULT 'none' NOT NULL
);
