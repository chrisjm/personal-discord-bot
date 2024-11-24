import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs";
import {
  WaterReminderDatabaseRow,
  WaterReminderPreferences,
} from "../types/water-reminder";

// Initialize database connection
const dbDir = path.join(__dirname, "../../data/sqlite");
const dbPath = path.join(dbDir, "water_reminder.db");

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error opening water reminder database:", err);
  } else {
    console.log("Connected to water reminder database");
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase(): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS water_reminder_preferences (
      user_id TEXT PRIMARY KEY,
      enabled INTEGER DEFAULT 0,
      start_time TEXT DEFAULT '08:00',
      end_time TEXT DEFAULT '19:00',
      timezone TEXT DEFAULT 'America/Los_Angeles'
    )
  `);
}

// Set user preferences
export async function setPreferences(prefs: WaterReminderPreferences): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT OR REPLACE INTO water_reminder_preferences
        (user_id, enabled, start_time, end_time, timezone)
        VALUES (?, ?, ?, ?, ?)`,
      [
        prefs.user_id,
        prefs.enabled ? 1 : 0,
        prefs.start_time,
        prefs.end_time,
        prefs.timezone,
      ],
      (err) => {
        if (err) {
          console.error("Database error in setPreferences:", err);
          reject(err);
        } else {
          resolve();
        }
      },
    );
  });
}

// Get user preferences
export async function getPreferences(
  userId: string,
): Promise<WaterReminderPreferences | null> {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT * FROM water_reminder_preferences WHERE user_id = ?",
      [userId],
      (err, row: WaterReminderDatabaseRow | undefined) => {
        if (err) {
          console.error("Database error in getPreferences:", err);
          reject(err);
        } else if (!row) {
          resolve(null);
        } else {
          resolve({
            user_id: row.user_id,
            enabled: row.enabled === 1,
            start_time: row.start_time,
            end_time: row.end_time,
            timezone: row.timezone,
          });
        }
      },
    );
  });
}

// Get all enabled users
export async function getAllEnabledUsers(): Promise<WaterReminderPreferences[]> {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT * FROM water_reminder_preferences WHERE enabled = 1",
      [],
      (err, rows: WaterReminderDatabaseRow[]) => {
        if (err) {
          console.error("Database error in getAllEnabledUsers:", err);
          reject(err);
        } else {
          resolve(
            rows.map((row) => ({
              user_id: row.user_id,
              enabled: row.enabled === 1,
              start_time: row.start_time,
              end_time: row.end_time,
              timezone: row.timezone,
            })),
          );
        }
      },
    );
  });
}
