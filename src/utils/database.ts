// Re-export the database managers from their respective files
export { waterDb } from './WaterDatabase';
export { cacheDb } from './CacheDatabase';
export { usMarketHistoryDb, cryptoMarketHistoryDb, worldMarketHistoryDb } from './marketHistory/index';
