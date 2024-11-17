import sqlite3 from 'sqlite3';
import { Database } from 'sqlite3';
import path from 'path';
import fs from 'fs';

export interface MarketStatusCache {
    status: string;
    spy_price: number;
    ten_year_yield: number;
    timestamp: number;
    valid_until: number;
}

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
        // Create market status cache table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS market_status_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                status TEXT NOT NULL,
                spy_price REAL NOT NULL,
                ten_year_yield REAL NOT NULL,
                timestamp INTEGER NOT NULL,
                valid_until INTEGER NOT NULL
            )
        `);
    }

    async getMarketStatusCache(): Promise<MarketStatusCache | null> {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM market_status_cache ORDER BY timestamp DESC LIMIT 1',
                (err, row) => {
                    if (err) {
                        console.error('Error getting market status cache:', err);
                        reject(err);
                    } else {
                        resolve(row as MarketStatusCache | null);
                    }
                }
            );
        });
    }

    async updateMarketStatusCache(cache: MarketStatusCache): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO market_status_cache (status, spy_price, ten_year_yield, timestamp, valid_until)
                 VALUES (?, ?, ?, ?, ?)`,
                [cache.status, cache.spy_price, cache.ten_year_yield, cache.timestamp, cache.valid_until],
                (err) => {
                    if (err) {
                        console.error('Error updating market status cache:', err);
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
