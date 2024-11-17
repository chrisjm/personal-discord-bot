import { Database } from 'sqlite3';
import { USMarketHistoryEntry } from './types';
import path from 'path';

class USMarketHistoryDatabase {
  private db: Database;
  private initialized: boolean = false;

  constructor() {
    // Use absolute path in sqlite directory
    const dbPath = path.join(process.cwd(), 'data', 'sqlite', 'us_market_history.db');
    this.db = new Database(dbPath);
    this.init().catch(console.error);
  }

  private async init() {
    if (this.initialized) return;

    return new Promise<void>((resolve, reject) => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS us_market_history (
          date TEXT PRIMARY KEY,
          spy_open REAL,
          spy_close REAL,
          spy_high REAL,
          spy_low REAL,
          ten_year_yield_open REAL,
          ten_year_yield_close REAL,
          volume INTEGER,
          timestamp INTEGER
        )
      `, (err) => {
        if (err) reject(err);
        else {
          // Create index on date for faster queries
          this.db.run(`
            CREATE INDEX IF NOT EXISTS idx_us_market_history_date 
            ON us_market_history(date)
          `, (err) => {
            if (err) reject(err);
            else {
              this.initialized = true;
              resolve();
            }
          });
        }
      });
    });
  }

  async addMarketHistory(entry: USMarketHistoryEntry): Promise<void> {
    await this.init(); // Ensure initialization

    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO us_market_history 
        (date, spy_open, spy_close, spy_high, spy_low, ten_year_yield_open, ten_year_yield_close, volume, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.date,
          entry.spy_open,
          entry.spy_close,
          entry.spy_high,
          entry.spy_low,
          entry.ten_year_yield_open,
          entry.ten_year_yield_close,
          entry.volume,
          entry.timestamp
        ],
        (err) => {
          if (err) {
            console.error('Error adding US market history:', err);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  async getLatestMarketHistory(days: number): Promise<USMarketHistoryEntry[]> {
    await this.init(); // Ensure initialization

    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM us_market_history 
         ORDER BY date DESC 
         LIMIT ?`,
        [days],
        (err, rows) => {
          if (err) {
            console.error('Error getting US market history:', err);
            reject(err);
          } else {
            resolve(rows as USMarketHistoryEntry[]);
          }
        }
      );
    });
  }

  async hasDataForDate(date: string): Promise<boolean> {
    await this.init(); // Ensure initialization

    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT 1 FROM us_market_history WHERE date = ?',
        [date],
        (err, row) => {
          if (err) {
            console.error('Error checking US market history:', err);
            reject(err);
          } else {
            resolve(!!row);
          }
        }
      );
    });
  }
}

export const usMarketHistoryDb = new USMarketHistoryDatabase();
