import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs";
import { LLMUsageStats } from "../../../types/llm";

// Initialize database connection
const dbDir = path.join(__dirname, "../../../../data/sqlite");
const dbPath = path.join(dbDir, "llm_stats.db");

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error opening LLM stats database:", err);
  } else {
    console.log("Connected to LLM stats database");
    initializeDatabase();
  }
});

interface UsageRecord extends LLMUsageStats {
  timestamp: number;
  userId: string;
  model: string;
  provider: string;
}

// Initialize database schema
const initializeDatabase = (): void => {
  db.run(`
    CREATE TABLE IF NOT EXISTS llm_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      userId TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      promptTokens INTEGER NOT NULL,
      completionTokens INTEGER NOT NULL,
      totalTokens INTEGER NOT NULL,
      estimatedCost REAL NOT NULL
    )
  `);
};

// Initialize the database on module load
initializeDatabase();

const recordUsage = async (
  userId: string,
  provider: string,
  model: string,
  usage: LLMUsageStats
): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO llm_usage (
        timestamp,
        userId,
        provider,
        model,
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCost
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Date.now(),
        userId,
        provider,
        model,
        usage.promptTokens,
        usage.completionTokens,
        usage.totalTokens,
        usage.estimatedCost,
      ],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

const getStats = async (
  userId?: string,
  days = 30
): Promise<{
  totalCost: number;
  totalTokens: number;
  usageByModel: Record<string, { tokens: number; cost: number }>;
}> => {
  const timeAgo = Date.now() - days * 24 * 60 * 60 * 1000;
  const userFilter = userId ? "AND userId = ?" : "";
  const params = userId ? [timeAgo, userId] : [timeAgo];

  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM llm_usage WHERE timestamp >= ? ${userFilter}`,
      params,
      (err, rows: UsageRecord[]) => {
        if (err) {
          reject(err);
          return;
        }

        const usageByModel: Record<string, { tokens: number; cost: number }> = {};
        let totalCost = 0;
        let totalTokens = 0;

        rows.forEach((row) => {
          if (!usageByModel[row.model]) {
            usageByModel[row.model] = { tokens: 0, cost: 0 };
          }
          usageByModel[row.model].tokens += row.totalTokens;
          usageByModel[row.model].cost += row.estimatedCost;
          totalCost += row.estimatedCost;
          totalTokens += row.totalTokens;
        });

        resolve({
          totalCost,
          totalTokens,
          usageByModel,
        });
      }
    );
  });
};

export const llmStats = {
  recordUsage,
  getStats,
};
