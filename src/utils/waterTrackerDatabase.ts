import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs";

export interface WaterEntry {
  entry_datetime: string;
  milliliters: number;
}

// Initialize database connection
const dbDir = path.join(__dirname, "../../data/sqlite");
const dbPath = path.join(dbDir, "water_tracker.db");

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error opening water tracker database:", err);
  } else {
    console.log("Connected to water tracker database");
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase(): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS water_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_datetime TEXT NOT NULL,
      milliliters INTEGER NOT NULL
    )
  `);
}

export function addEntry(milliliters: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const entry_datetime = new Date().toISOString();
    console.log("Adding entry in UTC:", { milliliters, entry_datetime });
    db.run(
      "INSERT INTO water_entries (entry_datetime, milliliters) VALUES (?, ?)",
      [entry_datetime, milliliters],
      (err) => {
        if (err) {
          console.error("Database error in addEntry:", err);
          reject(err);
        } else {
          resolve(`Successfully added ${milliliters}mL of water!`);
        }
      },
    );
  });
}

export function getEntriesInRange(
  startDate: string,
  endDate: string,
): Promise<WaterEntry[]> {
  return new Promise((resolve, reject) => {
    console.log("Fetching entries in UTC range:", { startDate, endDate });
    db.all<WaterEntry>(
      "SELECT entry_datetime, milliliters FROM water_entries WHERE entry_datetime BETWEEN ? AND ?",
      [startDate, endDate],
      (err, rows: WaterEntry[]) => {
        if (err) {
          console.error("Database error in getEntriesInRange:", err);
          reject(err);
        } else {
          console.log("Found entries:", rows);
          resolve(rows);
        }
      },
    );
  });
}
