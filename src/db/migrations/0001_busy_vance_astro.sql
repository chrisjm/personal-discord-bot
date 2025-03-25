PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_reminder_preferences` (
	`user_id` text NOT NULL,
	`reminder_type` text NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	`start_time` text DEFAULT '08:00' NOT NULL,
	`end_time` text DEFAULT '19:00' NOT NULL,
	`timezone` text DEFAULT 'America/Los_Angeles' NOT NULL,
	`frequency_minutes` integer NOT NULL,
	`random` integer DEFAULT 0 NOT NULL,
	`frequency_random_multiple` real DEFAULT 1 NOT NULL,
	`last_sent` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `reminder_type`)
);
--> statement-breakpoint
INSERT INTO `__new_reminder_preferences`("user_id", "reminder_type", "enabled", "start_time", "end_time", "timezone", "frequency_minutes", "random", "frequency_random_multiple", "last_sent") SELECT "user_id", "reminder_type", "enabled", "start_time", "end_time", "timezone", "frequency_minutes", "random", "frequency_random_multiple", "last_sent" FROM `reminder_preferences`;--> statement-breakpoint
DROP TABLE `reminder_preferences`;--> statement-breakpoint
ALTER TABLE `__new_reminder_preferences` RENAME TO `reminder_preferences`;--> statement-breakpoint
PRAGMA foreign_keys=ON;