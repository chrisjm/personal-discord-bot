import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs";

// Initialize database connection
const dbDir = path.join(__dirname, "../../data/sqlite");
const dbPath = path.join(dbDir, "rss.db");

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error opening RSS database:", err);
  } else {
    console.log("Connected to RSS database");
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase(): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS rss_feeds (
      name TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      update_frequency INTEGER DEFAULT 3600,
      last_update INTEGER DEFAULT 0,
      data TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rss_items (
      feed_name TEXT,
      guid TEXT,
      title TEXT,
      link TEXT,
      pubDate TEXT,
      content TEXT,
      processed INTEGER DEFAULT 0,
      PRIMARY KEY (feed_name, guid),
      FOREIGN KEY (feed_name) REFERENCES rss_feeds(name)
    )
  `);
}

export interface RSSFeed {
  name: string;
  url: string;
  channelId: string;
  updateFrequency?: number;
  data?: string;
}

export interface RSSItem {
  feedName: string;
  guid: string;
  title: string;
  link: string;
  pubDate: string;
  content: string;
  processed: boolean;
}

// Add or update an RSS feed
export async function setRSSFeed(feed: RSSFeed): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT OR REPLACE INTO rss_feeds (name, url, channel_id, update_frequency, data)
       VALUES (?, ?, ?, ?, ?)`,
      [
        feed.name,
        feed.url,
        feed.channelId,
        feed.updateFrequency || 3600,
        feed.data || null,
      ],
      (err) => {
        if (err) reject(err);
        else resolve();
      },
    );
  });
}

// Get an RSS feed by name
export async function getRSSFeed(name: string): Promise<RSSFeed | null> {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT * FROM rss_feeds WHERE name = ?",
      [name],
      (err, row: any) => {
        if (err) reject(err);
        else if (!row) resolve(null);
        else {
          resolve({
            name: row.name,
            url: row.url,
            channelId: row.channel_id,
            updateFrequency: row.update_frequency,
            data: row.data,
          });
        }
      },
    );
  });
}

// Get all RSS feeds
export async function getAllRSSFeeds(): Promise<RSSFeed[]> {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM rss_feeds", (err, rows: any[]) => {
      if (err) reject(err);
      else {
        resolve(
          rows.map((row) => ({
            name: row.name,
            url: row.url,
            channelId: row.channel_id,
            updateFrequency: row.update_frequency,
            data: row.data,
          })),
        );
      }
    });
  });
}

// Add RSS items
export async function addRSSItems(items: RSSItem[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO rss_items 
       (feed_name, guid, title, link, pubDate, content, processed)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );

    db.serialize(() => {
      db.run("BEGIN TRANSACTION");

      items.forEach((item) => {
        stmt.run(
          item.feedName,
          item.guid,
          item.title,
          item.link,
          item.pubDate,
          item.content,
          item.processed ? 1 : 0,
        );
      });

      db.run("COMMIT", (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    stmt.finalize();
  });
}

// Get unprocessed items for a feed
export async function getUnprocessedItems(
  feedName: string,
): Promise<RSSItem[]> {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT * FROM rss_items WHERE feed_name = ? AND processed = 0",
      [feedName],
      (err, rows: any[]) => {
        if (err) reject(err);
        else {
          resolve(
            rows.map((row) => ({
              feedName: row.feed_name,
              guid: row.guid,
              title: row.title,
              link: row.link,
              pubDate: row.pubDate,
              content: row.content,
              processed: Boolean(row.processed),
            })),
          );
        }
      },
    );
  });
}

// Mark items as processed
export async function markItemsAsProcessed(
  feedName: string,
  guids: string[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const placeholders = guids.map(() => "?").join(",");
    db.run(
      `UPDATE rss_items 
       SET processed = 1 
       WHERE feed_name = ? AND guid IN (${placeholders})`,
      [feedName, ...guids],
      (err) => {
        if (err) reject(err);
        else resolve();
      },
    );
  });
}

// Update last update time for a feed
export async function updateLastUpdateTime(feedName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(
      "UPDATE rss_feeds SET last_update = ? WHERE name = ?",
      [Math.floor(Date.now() / 1000), feedName],
      (err) => {
        if (err) reject(err);
        else resolve();
      },
    );
  });
}

// Delete a feed and its items
export async function deleteFeed(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");

      // Delete the feed
      db.run(
        "DELETE FROM rss_feeds WHERE name = ?",
        [name],
        (err) => {
          if (err) {
            db.run("ROLLBACK");
            reject(err);
            return;
          }
        },
      );

      // Delete all items for this feed
      db.run(
        "DELETE FROM rss_items WHERE feed_name = ?",
        [name],
        (err) => {
          if (err) {
            db.run("ROLLBACK");
            reject(err);
            return;
          }
        },
      );

      db.run("COMMIT", (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}
