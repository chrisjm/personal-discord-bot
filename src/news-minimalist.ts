import { TextChannel } from "discord.js";
import sqlite3 from "sqlite3";
import RSSParser from "rss-parser";

const rssParser = new RSSParser();
const db = new sqlite3.Database("data/sqlite/news_minimalist_rss_feed.db");

// Create the SQLite table if it doesn't already exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS feed_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      description TEXT,
      link TEXT UNIQUE,
      guid TEXT UNIQUE,
      pubDate DATETIME,
      displayed INTEGER DEFAULT 0
    )`);
});

export async function fetchRSSFeed(url: string): Promise<RSSParser.Item[]> {
  try {
    const feed = await rssParser.parseURL(url);
    return feed.items;
  } catch (err) {
    console.error("Error fetching RSS feed:", err);
    return [];
  }
}

export async function storeNewEntries(items: RSSParser.Item[]): Promise<void> {
  for (const item of items) {
    const title = item.title || "";
    const description = item.contentSnippet || item.description || "";
    const link = item.link || "";
    const guid = item.guid || item.link || "";
    const pubDate = item.pubDate || item.isoDate || "";

    db.run(
      `INSERT OR IGNORE INTO feed_entries (title, description, link, guid, pubDate)
      VALUES (?, ?, ?, ?, ?)`,
      [title, description, link, guid, pubDate],
      (err: Error | null) => {
        if (err) {
          console.error("Error inserting new entry:", err);
        }
      },
    );
  }
}

export function displayNewEntries(channel: TextChannel): void {
  db.all(
    "SELECT * FROM feed_entries WHERE displayed = 0 ORDER BY pubDate DESC",
    [],
    (err, rows) => {
      if (err) {
        console.error("Error fetching new entries:", err);
        return;
      }

      rows.forEach((row: any) => {
        // Post the new entries to a Discord channel
        channel.send({
          embeds: [
            {
              title: row.title,
              description: row.description,
              url: row.link,
              timestamp: new Date(row.pubDate).toISOString(),
            },
          ],
        });

        // After posting, mark the entry as displayed in the database
        db.run(
          "UPDATE feed_entries SET displayed = 1 WHERE guid = ?",
          [row.guid],
          (err: Error | null) => {
            if (err) {
              console.error("Error updating entry state:", err);
            }
          },
        );
      });
    },
  );
}
