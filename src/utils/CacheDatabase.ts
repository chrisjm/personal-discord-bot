import { db } from "../db";
import { genericCache } from "../db/schema/cache";
import { eq, sql } from "drizzle-orm";

// Define an interface for the cache entry
interface CacheEntry {
  value: string;
  timestamp: number;
  ttl: number;
}

// Database operations
export const get = async (key: string): Promise<any | null> => {
  try {
    const result = await db
      .select()
      .from(genericCache)
      .where(eq(genericCache.key, key))
      .limit(1);

    const row = result[0];
    if (!row) return null;

    // Check if entry has expired
    const now = Date.now();
    if (row.ttl > 0 && now - row.timestamp > row.ttl) {
      // Entry has expired, remove it
      await remove(key);
      return null;
    }

    try {
      return JSON.parse(row.value);
    } catch (e) {
      console.error("Error parsing cached value:", e);
      return null;
    }
  } catch (err) {
    console.error("Error getting from cache:", err);
    throw err;
  }
};

export const set = async (
  key: string,
  value: any,
  ttl: number = 0,
): Promise<void> => {
  try {
    const timestamp = Date.now();
    await db
      .insert(genericCache)
      .values({
        key,
        value: JSON.stringify(value),
        timestamp,
        ttl,
      })
      .onConflictDoUpdate({
        target: genericCache.key,
        set: {
          value: JSON.stringify(value),
          timestamp,
          ttl,
        },
      });
  } catch (err) {
    console.error("Error setting cache:", err);
    throw err;
  }
};

export const remove = async (key: string): Promise<void> => {
  try {
    await db.delete(genericCache).where(eq(genericCache.key, key));
  } catch (err) {
    console.error("Error removing from cache:", err);
    throw err;
  }
};

// Add cleanup function to remove expired entries
const cleanupExpiredEntries = async (): Promise<void> => {
  try {
    const now = Date.now();
    await db
      .delete(genericCache)
      .where(
        sql`${genericCache.ttl} > 0 AND (${now} - ${genericCache.timestamp}) > ${genericCache.ttl}`,
      );
  } catch (err) {
    console.error("Error cleaning up expired cache entries:", err);
    throw err;
  }
};

// Run cleanup every minute
setInterval(cleanupExpiredEntries, 60000);
