import sqlite3 from 'sqlite3';
import { Database } from 'sqlite3';
import path from 'path';
import fs from 'fs';

interface WaterEntry {
    entry_datetime: string;
    milliliters: number;
}

class DatabaseManager {
    private static instance: DatabaseManager;
    private db: Database;

    private constructor() {
        const dbDir = path.join(__dirname, '../../data/sqlite');
        const dbPath = path.join(dbDir, 'water_tracker.db');
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err);
            } else {
                console.log('Connected to database');
                this.initializeDatabase();
            }
        });
    }

    public static getInstance(): DatabaseManager {
        if (!DatabaseManager.instance) {
            DatabaseManager.instance = new DatabaseManager();
        }
        return DatabaseManager.instance;
    }

    private initializeDatabase(): void {
        this.db.run(`
            CREATE TABLE IF NOT EXISTS water_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entry_datetime TEXT NOT NULL,
                milliliters INTEGER NOT NULL
            )
        `);
    }

    public addEntry(milliliters: number): Promise<string> {
        return new Promise((resolve, reject) => {
            // Store in UTC
            const entry_datetime = new Date().toISOString();
            console.log('Adding entry in UTC:', { milliliters, entry_datetime });
            this.db.run(
                'INSERT INTO water_entries (entry_datetime, milliliters) VALUES (?, ?)',
                [entry_datetime, milliliters],
                (err) => {
                    if (err) {
                        console.error('Database error in addEntry:', err);
                        reject(err);
                    } else {
                        resolve(`Successfully added ${milliliters}mL of water!`);
                    }
                }
            );
        });
    }

    public getEntriesInRange(startDate: string, endDate: string): Promise<WaterEntry[]> {
        return new Promise((resolve, reject) => {
            console.log('Fetching entries in UTC range:', { startDate, endDate });
            this.db.all<WaterEntry>(
                'SELECT entry_datetime, milliliters FROM water_entries WHERE entry_datetime BETWEEN ? AND ?',
                [startDate, endDate],
                (err, rows: WaterEntry[]) => {
                    if (err) {
                        console.error('Database error in getEntriesInRange:', err);
                        reject(err);
                    } else {
                        console.log('Found entries:', rows);
                        resolve(rows);
                    }
                }
            );
        });
    }
}

export const db = DatabaseManager.getInstance();
