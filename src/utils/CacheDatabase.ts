import sqlite3 from 'sqlite3';
import { Database } from 'sqlite3';
import path from 'path';
import fs from 'fs';

class CacheDatabaseManager {
    private static instance: CacheDatabaseManager;
    private db: Database;

    private constructor() {
        const dbDir = path.join(__dirname, '../../data/sqlite');
        const dbPath = path.join(dbDir, 'cache.db');

        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening cache database:', err);
            } else {
                console.log('Connected to cache database');
                this.initializeDatabase();
            }
        });
    }

    public static getInstance(): CacheDatabaseManager {
        if (!CacheDatabaseManager.instance) {
            CacheDatabaseManager.instance = new CacheDatabaseManager();
        }
        return CacheDatabaseManager.instance;
    }

    private initializeDatabase(): void {
        // Create generic key-value cache table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS generic_cache (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                timestamp INTEGER NOT NULL
            )
        `);
    }

    async get(key: string): Promise<any | null> {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT value, timestamp FROM generic_cache WHERE key = ? LIMIT 1',
                [key],
                (err, row) => {
                    if (err) {
                        console.error('Error getting from cache:', err);
                        reject(err);
                    } else if (!row) {
                        resolve(null);
                    } else {
                        try {
                            resolve(JSON.parse(row.value));
                        } catch (e) {
                            console.error('Error parsing cached value:', e);
                            resolve(null);
                        }
                    }
                }
            );
        });
    }

    async set(key: string, value: any): Promise<void> {
        return new Promise((resolve, reject) => {
            const timestamp = Date.now();
            this.db.run(
                'INSERT OR REPLACE INTO generic_cache (key, value, timestamp) VALUES (?, ?, ?)',
                [key, JSON.stringify(value), timestamp],
                (err) => {
                    if (err) {
                        console.error('Error setting cache:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    async delete(key: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM generic_cache WHERE key = ?',
                [key],
                (err) => {
                    if (err) {
                        console.error('Error deleting from cache:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }
}

export const cacheDb = CacheDatabaseManager.getInstance();
