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
DROP TABLE `reminders`;