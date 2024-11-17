import { Database } from 'sqlite3';
import { WorldMarketHistoryEntry } from './types';

class WorldMarketHistoryDatabase {
  private db: Database;

  constructor() {
    this.db = new Database('data/sqlite/world_market_history.db');
    this.init().catch(console.error);
  }

  private async init() {
    return new Promise<void>((resolve, reject) => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS world_market_history (
          date TEXT PRIMARY KEY,
          timestamp INTEGER
          -- Additional columns will be added in future implementation
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async addMarketHistory(entry: WorldMarketHistoryEntry): Promise<void> {
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
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async getLatestMarketHistory(days: number): Promise<WorldMarketHistoryEntry[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM world_market_history
         ORDER BY date DESC
         LIMIT ?`,
        [days],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows as WorldMarketHistoryEntry[]);
        }
      );
    });
  }
}

export const worldMarketHistoryDb = new WorldMarketHistoryDatabase();
