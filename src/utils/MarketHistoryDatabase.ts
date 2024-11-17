import sqlite3 from 'sqlite3';
import { Database } from 'sqlite3';
import path from 'path';
import fs from 'fs';

export interface MarketHistoryEntry {
    date: string;
    spy_open: number;
    spy_close: number;
    spy_high: number;
    spy_low: number;
    ten_year_yield_open: number;
    ten_year_yield_close: number;
    volume: number;
    btc_price: number;
    btc_volume: number;
    btc_market_cap: number;
    eth_price: number;
    eth_volume: number;
    eth_market_cap: number;
    timestamp: number;
}

class MarketHistoryDatabaseManager {
    private static instance: MarketHistoryDatabaseManager;
    private db: Database;

    private constructor() {
        const dbDir = path.join(__dirname, '../../data/sqlite');
        const dbPath = path.join(dbDir, 'market_history.db');
        
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening market history database:', err);
            } else {
                console.log('Connected to market history database');
                this.initializeDatabase();
            }
        });
    }

    public static getInstance(): MarketHistoryDatabaseManager {
        if (!MarketHistoryDatabaseManager.instance) {
            MarketHistoryDatabaseManager.instance = new MarketHistoryDatabaseManager();
        }
        return MarketHistoryDatabaseManager.instance;
    }

    private initializeDatabase(): void {
        this.db.run(`
            CREATE TABLE IF NOT EXISTS market_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL UNIQUE,
                spy_open REAL NOT NULL,
                spy_close REAL NOT NULL,
                spy_high REAL NOT NULL,
                spy_low REAL NOT NULL,
                ten_year_yield_open REAL NOT NULL,
                ten_year_yield_close REAL NOT NULL,
                volume INTEGER NOT NULL,
                btc_price REAL NOT NULL DEFAULT 0,
                btc_volume REAL NOT NULL DEFAULT 0,
                btc_market_cap REAL NOT NULL DEFAULT 0,
                eth_price REAL NOT NULL DEFAULT 0,
                eth_volume REAL NOT NULL DEFAULT 0,
                eth_market_cap REAL NOT NULL DEFAULT 0,
                timestamp INTEGER NOT NULL
            )
        `);
    }

    async addMarketHistory(entry: MarketHistoryEntry): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR REPLACE INTO market_history 
                (date, spy_open, spy_close, spy_high, spy_low, 
                ten_year_yield_open, ten_year_yield_close, volume,
                btc_price, btc_volume, btc_market_cap,
                eth_price, eth_volume, eth_market_cap,
                timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    entry.date,
                    entry.spy_open,
                    entry.spy_close,
                    entry.spy_high,
                    entry.spy_low,
                    entry.ten_year_yield_open,
                    entry.ten_year_yield_close,
                    entry.volume,
                    entry.btc_price || 0,
                    entry.btc_volume || 0,
                    entry.btc_market_cap || 0,
                    entry.eth_price || 0,
                    entry.eth_volume || 0,
                    entry.eth_market_cap || 0,
                    entry.timestamp
                ],
                (err) => {
                    if (err) {
                        console.error('Error adding market history:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    async getLatestMarketHistory(days: number = 5): Promise<MarketHistoryEntry[]> {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM market_history ORDER BY date DESC LIMIT ?',
                [days],
                (err, rows) => {
                    if (err) {
                        console.error('Error getting market history:', err);
                        reject(err);
                    } else {
                        resolve(rows as MarketHistoryEntry[]);
                    }
                }
            );
        });
    }

    async getMarketHistoryByDate(date: string): Promise<MarketHistoryEntry | null> {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM market_history WHERE date = ?',
                [date],
                (err, row) => {
                    if (err) {
                        console.error('Error getting market history by date:', err);
                        reject(err);
                    } else {
                        resolve(row as MarketHistoryEntry | null);
                    }
                }
            );
        });
    }
}

export const marketHistoryDb = MarketHistoryDatabaseManager.getInstance();
