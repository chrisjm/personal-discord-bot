import { Database } from 'sqlite3';
import { CryptoMarketHistoryEntry } from './types';
import path from 'path';

class CryptoMarketHistoryDatabase {
  private db: Database;
  private initialized: boolean = false;

  constructor() {
    // Use absolute path in sqlite directory
    const dbPath = path.join(process.cwd(), 'data', 'sqlite', 'market_history.db');
    this.db = new Database(dbPath);
    this.init().catch(console.error);
  }

  private async init() {
    if (this.initialized) return;

    return new Promise<void>((resolve, reject) => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS crypto_market_history (
          date TEXT PRIMARY KEY,
          btc_price REAL,
          btc_volume REAL,
          btc_market_cap REAL,
          eth_price REAL,
          eth_volume REAL,
          eth_market_cap REAL,
          timestamp INTEGER
        )
      `, (err) => {
        if (err) reject(err);
        else {
          // Create index on date for faster queries
          this.db.run(`
            CREATE INDEX IF NOT EXISTS idx_crypto_market_history_date
            ON crypto_market_history(date)
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

  async addMarketHistory(entry: CryptoMarketHistoryEntry): Promise<void> {
    await this.init(); // Ensure initialization

    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO crypto_market_history
        (date, btc_price, btc_volume, btc_market_cap, eth_price, eth_volume, eth_market_cap, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.date,
          entry.btc_price,
          entry.btc_volume,
          entry.btc_market_cap,
          entry.eth_price,
          entry.eth_volume,
          entry.eth_market_cap,
          entry.timestamp
        ],
        (err) => {
          if (err) {
            console.error('Error adding crypto market history:', err);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  async getLatestMarketHistory(days: number): Promise<CryptoMarketHistoryEntry[]> {
    await this.init(); // Ensure initialization

    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM crypto_market_history
         ORDER BY date DESC
         LIMIT ?`,
        [days],
        (err, rows) => {
          if (err) {
            console.error('Error getting crypto market history:', err);
            reject(err);
          } else {
            resolve(rows as CryptoMarketHistoryEntry[]);
          }
        }
      );
    });
  }

  async hasDataForDate(date: string): Promise<boolean> {
    await this.init(); // Ensure initialization

    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT 1 FROM crypto_market_history WHERE date = ?',
        [date],
        (err, row) => {
          if (err) {
            console.error('Error checking crypto market history:', err);
            reject(err);
          } else {
            resolve(!!row);
          }
        }
      );
    });
  }
}

export const cryptoMarketHistoryDb = new CryptoMarketHistoryDatabase();
