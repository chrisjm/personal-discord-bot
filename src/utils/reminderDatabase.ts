import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs";
import { ReminderDatabaseRow, ReminderPreferences } from "../types/reminder";

// Initialize database connection
const dbDir = path.join(__dirname, "../../data/sqlite");
const dbPath = path.join(dbDir, "reminders.db");

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error opening reminders database:", err);
  } else {
    console.log("Connected to reminders database");
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase(): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS reminder_preferences (
      user_id TEXT,
      reminder_type TEXT,
      enabled INTEGER DEFAULT 0,
      start_time TEXT DEFAULT '08:00',
      end_time TEXT DEFAULT '19:00',
      timezone TEXT DEFAULT 'America/Los_Angeles',
      frequency_minutes INTEGER,
      PRIMARY KEY (user_id, reminder_type)
    )
  `);
}

// Set user preferences
export async function setPreferences(
  prefs: ReminderPreferences,
): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT OR REPLACE INTO reminder_preferences
        (user_id, reminder_type, enabled, start_time, end_time, timezone, frequency_minutes)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        prefs.user_id,
        prefs.reminder_type,
        prefs.enabled ? 1 : 0,
        prefs.start_time,
        prefs.end_time,
        prefs.timezone,
        prefs.frequency_minutes || null,
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

// Get user preferences for a specific reminder type
export async function getPreferences(
  userId: string,
  reminderType: string,
): Promise<ReminderPreferences | null> {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT * FROM reminder_preferences WHERE user_id = ? AND reminder_type = ?",
      [userId, reminderType],
      (err, row: ReminderDatabaseRow | undefined) => {
        if (err) {
          console.error("Database error in getPreferences:", err);
          reject(err);
        } else if (!row) {
          resolve(null);
        } else {
          resolve({
            user_id: row.user_id,
            reminder_type: row.reminder_type,
            enabled: row.enabled === 1,
            start_time: row.start_time,
            end_time: row.end_time,
            timezone: row.timezone,
            frequency_minutes: row.frequency_minutes || undefined,
          });
        }
      },
    );
  });
}

// Get all enabled users for a specific reminder type
export async function getAllEnabledUsers(
  reminderType: string,
): Promise<ReminderPreferences[]> {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT * FROM reminder_preferences WHERE enabled = 1 AND reminder_type = ?",
      [reminderType],
      (err, rows: ReminderDatabaseRow[]) => {
        if (err) {
          console.error("Database error in getAllEnabledUsers:", err);
          reject(err);
        } else {
          resolve(
            rows.map((row) => ({
              user_id: row.user_id,
              reminder_type: row.reminder_type,
              enabled: row.enabled === 1,
              start_time: row.start_time,
              end_time: row.end_time,
              timezone: row.timezone,
              frequency_minutes: row.frequency_minutes || undefined,
            })),
          );
        }
      },
    );
  });
}
