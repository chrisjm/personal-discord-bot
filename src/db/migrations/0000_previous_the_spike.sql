CREATE TABLE `generic_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`timestamp` integer NOT NULL,
	`ttl` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`message` text NOT NULL,
	`timestamp` integer NOT NULL,
	`recurring` text,
	`completed` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rss_feeds` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`channel_id` text NOT NULL,
	`last_checked` integer NOT NULL,
	`last_item_guid` text
);
--> statement-breakpoint
CREATE TABLE `tracking` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`value` text NOT NULL,
	`timestamp` integer NOT NULL
);
