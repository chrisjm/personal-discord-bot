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

export interface CryptoMarketCache {
    status: string;
    btc_price: number;
    btc_change_24h: number;
    eth_price: number;
    eth_change_24h: number;
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

        // Create crypto market cache table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS crypto_market_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                status TEXT NOT NULL,
                btc_price REAL NOT NULL,
                btc_change_24h REAL NOT NULL,
                eth_price REAL NOT NULL,
                eth_change_24h REAL NOT NULL,
                timestamp INTEGER NOT NULL,
                valid_until INTEGER NOT NULL
            )
        `);

        // Create generic key-value cache table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS generic_cache (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                timestamp INTEGER NOT NULL
            )
        `);

        // Create world markets cache table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS world_markets_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                status TEXT NOT NULL,
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

    async getCryptoMarketCache(): Promise<CryptoMarketCache | null> {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM crypto_market_cache ORDER BY timestamp DESC LIMIT 1',
                (err, row) => {
                    if (err) {
                        console.error('Error getting crypto market cache:', err);
                        reject(err);
                    } else {
                        resolve(row as CryptoMarketCache | null);
                    }
                }
            );
        });
    }

    async updateCryptoMarketCache(cache: CryptoMarketCache): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO crypto_market_cache (
                    status, btc_price, btc_change_24h, eth_price, eth_change_24h, timestamp, valid_until
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    cache.status,
                    cache.btc_price,
                    cache.btc_change_24h,
                    cache.eth_price,
                    cache.eth_change_24h,
                    cache.timestamp,
                    cache.valid_until
                ],
                (err) => {
                    if (err) {
                        console.error('Error updating crypto market cache:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    async get(key: string): Promise<any | null> {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT value, timestamp FROM generic_cache WHERE key = ?',
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
}

export const cacheDb = CacheDatabaseManager.getInstance();
