import { Database } from 'sqlite3';
import path from 'path';
import { WorldMarketData } from '../../commands/markets/worldMarkets';

export interface WorldMarketHistoryEntry {
  date: string;
  timestamp: number;
  // Europe
  dax_price: number;
  dax_change: number;
  dax_percent_change: number;
  dax_previous_close: number;
  ftse100_price: number;
  ftse100_change: number;
  ftse100_percent_change: number;
  ftse100_previous_close: number;
  cac40_price: number;
  cac40_change: number;
  cac40_percent_change: number;
  cac40_previous_close: number;
  // Asia
  nikkei_price: number;
  nikkei_change: number;
  nikkei_percent_change: number;
  nikkei_previous_close: number;
  hang_seng_price: number;
  hang_seng_change: number;
  hang_seng_percent_change: number;
  hang_seng_previous_close: number;
  shanghai_price: number;
  shanghai_change: number;
  shanghai_percent_change: number;
  shanghai_previous_close: number;
}

class WorldMarketHistoryDatabase {
  private db: Database;
  private initialized: boolean = false;

  constructor() {
    const dbPath = path.join(process.cwd(), 'data', 'sqlite', 'market_history.db');
    console.log(`Initializing world market history database at ${dbPath}`);
    this.db = new Database(dbPath);
    this.init().catch(err => {
      console.error('Failed to initialize world market history database:', err);
    });
    console.log('Successfully connected to world market history database');
  }

  private async init() {
    if (this.initialized) {
      console.log('World market history database already initialized');
      return;
    }

    return new Promise<void>((resolve, reject) => {
      console.log('Creating world market history table if not exists...');
      this.db.run(`
        CREATE TABLE IF NOT EXISTS world_market_history (
          date TEXT PRIMARY KEY,
          timestamp INTEGER,
          -- Europe
          dax_price REAL,
          dax_change REAL,
          dax_percent_change REAL,
          dax_previous_close REAL,
          ftse100_price REAL,
          ftse100_change REAL,
          ftse100_percent_change REAL,
          ftse100_previous_close REAL,
          cac40_price REAL,
          cac40_change REAL,
          cac40_percent_change REAL,
          cac40_previous_close REAL,
          -- Asia
          nikkei_price REAL,
          nikkei_change REAL,
          nikkei_percent_change REAL,
          nikkei_previous_close REAL,
          hang_seng_price REAL,
          hang_seng_change REAL,
          hang_seng_percent_change REAL,
          hang_seng_previous_close REAL,
          shanghai_price REAL,
          shanghai_change REAL,
          shanghai_percent_change REAL,
          shanghai_previous_close REAL
        )
      `, (err) => {
        if (err) reject(err);
        else {
          // Create index on date for faster queries
          this.db.run(`
            CREATE INDEX IF NOT EXISTS idx_world_market_history_date
            ON world_market_history(date)
          `, (err) => {
            if (err) {
              console.error('Failed to create index on world market history table:', err);
              reject(err);
            } else {
              this.initialized = true;
              console.log('Successfully initialized world market history database and created index');
              resolve();
            }
          });
        }
      });
    });
  }

  async addMarketHistory(data: WorldMarketData): Promise<void> {
    if (!this.initialized) {
      console.warn('Attempting to add entry before database initialization');
    }
    await this.init();

    const date = new Date(data.markets.timestamp).toISOString().split('T')[0];
    const entry: WorldMarketHistoryEntry = {
      date,
      timestamp: data.markets.timestamp,
      // Europe
      dax_price: data.markets.europe.dax.price,
      dax_change: data.markets.europe.dax.change,
      dax_percent_change: data.markets.europe.dax.percentChange,
      dax_previous_close: data.markets.europe.dax.previousClose,
      ftse100_price: data.markets.europe.ftse100.price,
      ftse100_change: data.markets.europe.ftse100.change,
      ftse100_percent_change: data.markets.europe.ftse100.percentChange,
      ftse100_previous_close: data.markets.europe.ftse100.previousClose,
      cac40_price: data.markets.europe.cac40.price,
      cac40_change: data.markets.europe.cac40.change,
      cac40_percent_change: data.markets.europe.cac40.percentChange,
      cac40_previous_close: data.markets.europe.cac40.previousClose,
      // Asia
      nikkei_price: data.markets.asia.nikkei.price,
      nikkei_change: data.markets.asia.nikkei.change,
      nikkei_percent_change: data.markets.asia.nikkei.percentChange,
      nikkei_previous_close: data.markets.asia.nikkei.previousClose,
      hang_seng_price: data.markets.asia.hang_seng.price,
      hang_seng_change: data.markets.asia.hang_seng.change,
      hang_seng_percent_change: data.markets.asia.hang_seng.percentChange,
      hang_seng_previous_close: data.markets.asia.hang_seng.previousClose,
      shanghai_price: data.markets.asia.shanghai.price,
      shanghai_change: data.markets.asia.shanghai.change,
      shanghai_percent_change: data.markets.asia.shanghai.percentChange,
      shanghai_previous_close: data.markets.asia.shanghai.previousClose,
    };

    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO world_market_history (
          date, timestamp,
          dax_price, dax_change, dax_percent_change, dax_previous_close,
          ftse100_price, ftse100_change, ftse100_percent_change, ftse100_previous_close,
          cac40_price, cac40_change, cac40_percent_change, cac40_previous_close,
          nikkei_price, nikkei_change, nikkei_percent_change, nikkei_previous_close,
          hang_seng_price, hang_seng_change, hang_seng_percent_change, hang_seng_previous_close,
          shanghai_price, shanghai_change, shanghai_percent_change, shanghai_previous_close
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.date, entry.timestamp,
          entry.dax_price, entry.dax_change, entry.dax_percent_change, entry.dax_previous_close,
          entry.ftse100_price, entry.ftse100_change, entry.ftse100_percent_change, entry.ftse100_previous_close,
          entry.cac40_price, entry.cac40_change, entry.cac40_percent_change, entry.cac40_previous_close,
          entry.nikkei_price, entry.nikkei_change, entry.nikkei_percent_change, entry.nikkei_previous_close,
          entry.hang_seng_price, entry.hang_seng_change, entry.hang_seng_percent_change, entry.hang_seng_previous_close,
          entry.shanghai_price, entry.shanghai_change, entry.shanghai_percent_change, entry.shanghai_previous_close
        ],
        (err) => {
          if (err) {
            console.error('Failed to insert world market history entry:', err, '\nEntry:', entry);
            reject(err);
          } else {
            console.log(`Successfully inserted world market data for date: ${entry.date}`);
            resolve();
          }
        }
      );
    });
  }

  async getMarketHistory(startDate: string, endDate: string): Promise<WorldMarketHistoryEntry[]> {
    await this.init();

    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM world_market_history
         WHERE date BETWEEN ? AND ?
         ORDER BY date ASC`,
        [startDate, endDate],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows as WorldMarketHistoryEntry[]);
        }
      );
    });
  }

  async getLatestEntry(): Promise<WorldMarketHistoryEntry | null> {
    await this.init();

    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM world_market_history
         ORDER BY date DESC
         LIMIT 1`,
        (err, row) => {
          if (err) reject(err);
          else resolve(row as WorldMarketHistoryEntry || null);
        }
      );
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

export const worldMarketHistoryDb = new WorldMarketHistoryDatabase();
