import { cacheDb } from "../../../utils/database";
import { CacheConfig } from "./types";

export class MarketCache {
  private static instance: MarketCache;
  private constructor() {}

  public static getInstance(): MarketCache {
    if (!MarketCache.instance) {
      MarketCache.instance = new MarketCache();
    }
    return MarketCache.instance;
  }

  async get<T>(config: CacheConfig): Promise<T | null> {
    const cached = await cacheDb.get(config.key);
    if (!cached) return null;

    const { data, timestamp } = cached;
    if (Date.now() - timestamp > config.duration) {
      await this.invalidate(config.key);
      return null;
    }

    return data as T;
  }

  async set<T>(config: CacheConfig, data: T): Promise<void> {
    await cacheDb.set(config.key, {
      data,
      timestamp: Date.now()
    });
  }

  async invalidate(key: string): Promise<void> {
    await cacheDb.delete(key);
  }
}
