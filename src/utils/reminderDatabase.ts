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
      random INTEGER DEFAULT 0,
      frequency_random_multiple REAL DEFAULT 1.0,
      last_sent INTEGER DEFAULT 0,
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
        (user_id, reminder_type, enabled, start_time, end_time, timezone, frequency_minutes, random, frequency_random_multiple, last_sent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        prefs.user_id,
        prefs.reminder_type,
        prefs.enabled ? 1 : 0,
        prefs.start_time,
        prefs.end_time,
        prefs.timezone,
        prefs.frequency_minutes,
        prefs.random || 0,
        prefs.frequency_random_multiple || 1.0,
        prefs.last_sent || 0,
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
            frequency_minutes: row.frequency_minutes,
            random: row.random === 1,
            frequency_random_multiple: row.frequency_random_multiple || 1.0,
            last_sent: row.last_sent,
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
              frequency_minutes: row.frequency_minutes || 60,
              random: row.random === 1,
              frequency_random_multiple: row.frequency_random_multiple || 1.0,
              last_sent: row.last_sent,
            })),
          );
        }
      },
    );
  });
}

// Update last sent time for a reminder
export async function updateLastSent(
  userId: string,
  reminderType: string,
  timestamp: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(
      "UPDATE reminder_preferences SET last_sent = ? WHERE user_id = ? AND reminder_type = ?",
      [timestamp, userId, reminderType],
      (err) => {
        if (err) {
          console.error("Database error in updateLastSent:", err);
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
}
