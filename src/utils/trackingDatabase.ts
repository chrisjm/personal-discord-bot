import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs";

export interface TrackingEntry {
  entry_datetime: string;
  type: string;
  amount: number;
  unit: string;
  note: string;
}

// Initialize database connection
const dbDir = path.join(__dirname, "../../data/sqlite");
const dbPath = path.join(dbDir, "tracking.db");

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error opening tracking database:", err);
  } else {
    console.log("Connected to tracking database");
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase(): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS tracking_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_datetime TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      unit TEXT NOT NULL,
      note TEXT
    )
  `);
}

export function addEntry(
  type: string,
  amount: number,
  unit: string,
  note?: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const entry_datetime = new Date().toISOString();
    console.log("Adding entry in UTC:", {
      type,
      amount,
      unit,
      note,
      entry_datetime,
    });
    db.run(
      "INSERT INTO tracking_entries (entry_datetime, type, amount, unit, note) VALUES (?, ?, ?, ?, ?)",
      [entry_datetime, type, amount, unit, note || null],
      (err) => {
        if (err) {
          console.error("Database error in addEntry:", err);
          reject(err);
        } else {
          resolve(`Successfully tracked ${amount}${unit} of ${type}!`);
        }
      },
    );
  });
}

export function getEntriesInRange(
  type: string,
  startDate: string,
  endDate: string,
): Promise<TrackingEntry[]> {
  return new Promise((resolve, reject) => {
    console.log("Fetching entries in UTC range:", { type, startDate, endDate });
    db.all<TrackingEntry>(
      `SELECT entry_datetime, type, amount, unit, note 
       FROM tracking_entries 
       WHERE type = ? AND entry_datetime BETWEEN ? AND ?`,
      [type, startDate, endDate],
      (err, rows: TrackingEntry[]) => {
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

export function getEntriesForDay(
  type: string,
  date: string,
): Promise<TrackingEntry[]> {
  return new Promise((resolve, reject) => {
    console.log("Fetching entries for day in UTC:", { type, date });
    db.all<TrackingEntry>(
      `SELECT entry_datetime, type, amount, unit, note 
       FROM tracking_entries 
       WHERE type = ? AND date(entry_datetime) = date(?)`,
      [type, date],
      (err, rows: TrackingEntry[]) => {
        if (err) {
          console.error("Database error in getEntriesForDay:", err);
          reject(err);
        } else {
          console.log("Found entries:", rows);
          resolve(rows);
        }
      },
    );
  });
}
