import { Database } from 'sqlite3';
import { WorldMarketHistoryEntry } from './types';
import path from 'path';

class WorldMarketHistoryDatabase {
  private db: Database;
  private initialized: boolean = false;

  constructor() {
    const dbPath = path.join(process.cwd(), 'data', 'sqlite', 'market_history.db');
    this.db = new Database(dbPath);
    this.init().catch(console.error);
  }

  private async init() {
    if (this.initialized) return;

    return new Promise<void>((resolve, reject) => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS world_market_history (
          date TEXT PRIMARY KEY,
          timestamp INTEGER
          -- Additional columns will be added in future implementation
        )
      `, (err) => {
        if (err) reject(err);
        else {
          // Create index on date for faster queries
          this.db.run(`
            CREATE INDEX IF NOT EXISTS idx_world_market_history_date
            ON world_market_history(date)
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

  async addMarketHistory(entry: WorldMarketHistoryEntry): Promise<void> {
    await this.init(); // Ensure initialization

    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO world_market_history
        (date, timestamp)
        VALUES (?, ?)`,
        [
          entry.date,
          entry.timestamp
        ],
        (err) => {
          if (err) {
            console.error('Error adding world market history:', err);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  async getLatestMarketHistory(days: number): Promise<WorldMarketHistoryEntry[]> {
    await this.init(); // Ensure initialization

    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM world_market_history
         ORDER BY date DESC
         LIMIT ?`,
        [days],
        (err, rows) => {
          if (err) {
            console.error('Error getting world market history:', err);
            reject(err);
          } else {
            resolve(rows as WorldMarketHistoryEntry[]);
          }
        }
      );
    });
  }

  async hasDataForDate(date: string): Promise<boolean> {
    await this.init(); // Ensure initialization

    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT 1 FROM world_market_history WHERE date = ?',
        [date],
        (err, row) => {
          if (err) {
            console.error('Error checking world market history:', err);
            reject(err);
          } else {
            resolve(!!row);
          }
        }
      );
    });
  }
}

export const worldMarketHistoryDb = new WorldMarketHistoryDatabase();
