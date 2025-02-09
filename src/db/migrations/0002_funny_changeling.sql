PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_rss_items` (
	`feed_name` text NOT NULL,
	`guid` text NOT NULL,
	`title` text NOT NULL,
	`link` text NOT NULL,
	`pub_date` text NOT NULL,
	`content` text NOT NULL,
	`processed` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`feed_name`, `guid`),
	FOREIGN KEY (`feed_name`) REFERENCES `rss_feeds`(`name`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_rss_items`("feed_name", "guid", "title", "link", "pub_date", "content", "processed") SELECT "feed_name", "guid", "title", "link", "pub_date", "content", "processed" FROM `rss_items`;--> statement-breakpoint
DROP TABLE `rss_items`;--> statement-breakpoint
ALTER TABLE `__new_rss_items` RENAME TO `rss_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;