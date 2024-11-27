import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs";

// Initialize database connection
const dbDir = path.join(__dirname, "../../data/sqlite");
const dbPath = path.join(dbDir, "news.db");

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error opening News database:", err);
  } else {
    console.log("Connected to News database");
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase(): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS newsapi (
      guid TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      url TEXT NOT NULL,
      source_name TEXT,
      source_id TEXT,
      published_at TEXT,
      category TEXT,
      has_been_shown INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS newsapi_analysis (
      guid TEXT PRIMARY KEY,
      summary TEXT,
      sentiment_score REAL,
      entities TEXT,
      emojis TEXT,
      analysis_date INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (guid) REFERENCES newsapi(guid)
    )
  `);
}

export interface NewsArticle {
  guid: string;
  title: string;
  description: string | null;
  url: string;
  sourceName: string;
  sourceId: string | null;
  publishedAt: string;
  category: string;
  hasBeenShown: boolean;
}

export interface NewsAnalysis {
  guid: string;
  summary: string;
  sentimentScore: number;
  entities: string[];
  emojis: string[];
}

// Add or update a news article
export async function addNewsArticle(article: NewsArticle): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT OR REPLACE INTO newsapi (
        guid, title, description, url, source_name, source_id, 
        published_at, category, has_been_shown
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        article.guid,
        article.title,
        article.description,
        article.url,
        article.sourceName,
        article.sourceId,
        article.publishedAt,
        article.category,
        article.hasBeenShown ? 1 : 0,
      ],
      (err) => {
        if (err) reject(err);
        else resolve();
      },
    );
  });
}

// Add or update article analysis
export async function addNewsAnalysis(analysis: NewsAnalysis): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT OR REPLACE INTO newsapi_analysis (
        guid, summary, sentiment_score, entities, emojis
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        analysis.guid,
        analysis.summary,
        analysis.sentimentScore,
        JSON.stringify(analysis.entities),
        JSON.stringify(analysis.emojis),
      ],
      (err) => {
        if (err) reject(err);
        else resolve();
      },
    );
  });
}

// Get unshown articles for a category
export async function getUnshownArticles(category: string): Promise<NewsArticle[]> {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM newsapi 
       WHERE category = ? AND has_been_shown = 0 
       ORDER BY published_at DESC LIMIT 5`,
      [category],
      (err, rows: any[]) => {
        if (err) reject(err);
        else {
          resolve(
            rows.map((row) => ({
              guid: row.guid,
              title: row.title,
              description: row.description,
              url: row.url,
              sourceName: row.source_name,
              sourceId: row.source_id,
              publishedAt: row.published_at,
              category: row.category,
              hasBeenShown: Boolean(row.has_been_shown),
            })),
          );
        }
      },
    );
  });
}

// Get a single news article by guid
export async function getNewsArticle(guid: string): Promise<NewsArticle | null> {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT 
        guid, title, description, url, source_name as sourceName, 
        source_id as sourceId, published_at as publishedAt, 
        category, has_been_shown as hasBeenShown 
      FROM newsapi WHERE guid = ?`,
      [guid],
      (err, row: any) => {
        if (err) reject(err);
        else if (!row) resolve(null);
        else {
          resolve({
            ...row,
            hasBeenShown: !!row.hasBeenShown
          });
        }
      }
    );
  });
}

// Get cached analysis for an article
export async function getNewsAnalysis(guid: string): Promise<NewsAnalysis | null> {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT * FROM newsapi_analysis WHERE guid = ?",
      [guid],
      (err, row: any) => {
        if (err) reject(err);
        else if (!row) resolve(null);
        else {
          resolve({
            guid: row.guid,
            summary: row.summary,
            sentimentScore: row.sentiment_score,
            entities: JSON.parse(row.entities),
            emojis: JSON.parse(row.emojis),
          });
        }
      },
    );
  });
}

// Mark articles as shown
export async function markArticlesAsShown(guids: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const placeholders = guids.map(() => "?").join(",");
    db.run(
      `UPDATE newsapi SET has_been_shown = 1 
       WHERE guid IN (${placeholders})`,
      guids,
      (err) => {
        if (err) reject(err);
        else resolve();
      },
    );
  });
}

// Clean up old articles (older than 30 days)
export async function cleanupOldArticles(): Promise<void> {
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
  return new Promise((resolve, reject) => {
    db.run(
      `DELETE FROM newsapi_analysis 
       WHERE guid IN (
         SELECT guid FROM newsapi 
         WHERE created_at < ?
       )`,
      [thirtyDaysAgo],
      (err) => {
        if (err) {
          reject(err);
          return;
        }
        db.run(
          "DELETE FROM newsapi WHERE created_at < ?",
          [thirtyDaysAgo],
          (err) => {
            if (err) reject(err);
            else resolve();
          },
        );
      },
    );
  });
}
