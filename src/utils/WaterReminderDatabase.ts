import sqlite3 from 'sqlite3';
import { Database } from 'sqlite3';
import path from 'path';
import fs from 'fs';

export interface WaterReminderPreferences {
    user_id: string;
    enabled: boolean;
    start_time: string; // HH:mm format
    end_time: string; // HH:mm format
    timezone: string;
}

class WaterReminderDatabaseManager {
    private static instance: WaterReminderDatabaseManager;
    private db: Database;

    private constructor() {
        const dbDir = path.join(__dirname, '../../data/sqlite');
        const dbPath = path.join(dbDir, 'water_reminder.db');
        
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening water reminder database:', err);
            } else {
                console.log('Connected to water reminder database');
                this.initializeDatabase();
            }
        });
    }

    public static getInstance(): WaterReminderDatabaseManager {
        if (!WaterReminderDatabaseManager.instance) {
            WaterReminderDatabaseManager.instance = new WaterReminderDatabaseManager();
        }
        return WaterReminderDatabaseManager.instance;
    }

    private initializeDatabase(): void {
        this.db.run(`
            CREATE TABLE IF NOT EXISTS water_reminder_preferences (
                user_id TEXT PRIMARY KEY,
                enabled INTEGER DEFAULT 0,
                start_time TEXT DEFAULT '08:00',
                end_time TEXT DEFAULT '19:00',
                timezone TEXT DEFAULT 'America/Los_Angeles'
            )
        `);
    }

    public async setPreferences(prefs: WaterReminderPreferences): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR REPLACE INTO water_reminder_preferences 
                (user_id, enabled, start_time, end_time, timezone)
                VALUES (?, ?, ?, ?, ?)`,
                [prefs.user_id, prefs.enabled ? 1 : 0, prefs.start_time, prefs.end_time, prefs.timezone],
                (err) => {
                    if (err) {
                        console.error('Database error in setPreferences:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    public async getPreferences(userId: string): Promise<WaterReminderPreferences | null> {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM water_reminder_preferences WHERE user_id = ?',
                [userId],
                (err, row) => {
                    if (err) {
                        console.error('Database error in getPreferences:', err);
                        reject(err);
                    } else if (!row) {
                        resolve(null);
                    } else {
                        resolve({
                            user_id: row.user_id,
                            enabled: row.enabled === 1,
                            start_time: row.start_time,
                            end_time: row.end_time,
                            timezone: row.timezone
                        });
                    }
                }
            );
        });
    }

    public async getAllActiveUsers(): Promise<WaterReminderPreferences[]> {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM water_reminder_preferences WHERE enabled = 1',
                [],
                (err, rows) => {
                    if (err) {
                        console.error('Database error in getAllActiveUsers:', err);
                        reject(err);
                    } else {
                        resolve(rows.map(row => ({
                            user_id: row.user_id,
                            enabled: row.enabled === 1,
                            start_time: row.start_time,
                            end_time: row.end_time,
                            timezone: row.timezone
                        })));
                    }
                }
            );
        });
    }
}

export const waterReminderDb = WaterReminderDatabaseManager.getInstance();
