import sqlite3 from "sqlite3";
import { Database } from "sqlite3";
import path from "path";
import fs from "fs";

// Initialize database connection
const initializeDatabase = (db: Database): void => {
  db.run(`
        CREATE TABLE IF NOT EXISTS generic_cache (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            timestamp INTEGER NOT NULL
        )
    `);
};

// Create and setup database connection
const setupDatabase = (): Database => {
  const dbDir = path.join(__dirname, "../../data/sqlite");
  const dbPath = path.join(dbDir, "cache.db");

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error("Error opening cache database:", err);
    } else {
      console.log("Connected to cache database");
      initializeDatabase(db);
    }
  });

  return db;
};

const db = setupDatabase();

// Define an interface for the database row
interface CacheRow {
  value: string;
  timestamp: number;
}

// Database operations
export const get = async (key: string): Promise<any | null> => {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT value, timestamp FROM generic_cache WHERE key = ? LIMIT 1",
      [key],
      (err, row: CacheRow | undefined) => {
        if (err) {
          console.error("Error getting from cache:", err);
          reject(err);
        } else if (!row) {
          resolve(null);
        } else {
          try {
            resolve(JSON.parse(row.value));
          } catch (e) {
            console.error("Error parsing cached value:", e);
            resolve(null);
          }
        }
      },
    );
  });
};

export const set = async (key: string, value: any): Promise<void> => {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    db.run(
      "INSERT OR REPLACE INTO generic_cache (key, value, timestamp) VALUES (?, ?, ?)",
      [key, JSON.stringify(value), timestamp],
      (err) => {
        if (err) {
          console.error("Error setting cache:", err);
          reject(err);
        } else {
          resolve();
        }
      },
    );
  });
};

export const remove = async (key: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM generic_cache WHERE key = ?", [key], (err) => {
      if (err) {
        console.error("Error deleting from cache:", err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
};
