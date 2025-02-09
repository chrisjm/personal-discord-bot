CREATE TABLE `generic_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`timestamp` integer NOT NULL,
	`ttl` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reminder_preferences` (
	`user_id` text NOT NULL,
	`reminder_type` text NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	`start_time` text DEFAULT '08:00' NOT NULL,
	`end_time` text DEFAULT '19:00' NOT NULL,
	`timezone` text DEFAULT 'America/Los_Angeles' NOT NULL,
	`frequency_minutes` integer NOT NULL,
	`random` integer DEFAULT 0 NOT NULL,
	`frequency_random_multiple` real DEFAULT 1 NOT NULL,
	`last_sent` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rss_feeds` (
	`name` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`channel_id` text NOT NULL,
	`update_frequency` integer DEFAULT 3600 NOT NULL,
	`last_update` integer DEFAULT 0 NOT NULL,
	`data` text
);
--> statement-breakpoint
CREATE TABLE `rss_items` (
	`feed_name` text NOT NULL,
	`guid` text NOT NULL,
	`title` text NOT NULL,
	`link` text NOT NULL,
	`pub_date` text NOT NULL,
	`content` text NOT NULL,
	`processed` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`feed_name`) REFERENCES `rss_feeds`(`name`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tracking` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`value` text NOT NULL,
	`timestamp` integer NOT NULL
);
