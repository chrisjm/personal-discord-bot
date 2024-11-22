export interface MarketState {
  marketState?: 'PRE' | 'REGULAR' | 'POST' | 'CLOSED';
  regularMarketPrice: number;
  regularMarketPreviousClose: number;
  regularMarketOpen?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
}

export interface BaseAsset {
  symbol: string;
  price: number;
  change: number;
  percentChange: number;
  previousClose: number;
  isOpen: boolean;
  lastTradeTime: number;
}

export interface HistoricalDataPoint {
  timestamp: number;
  price: number;
  change: number;
  percentChange: number;
}

export interface CacheConfig {
  duration: number;  // Cache duration in milliseconds
  key: string;      // Cache key for the data
}

export interface ProviderConfig {
  retryAttempts: number;
  retryDelay: number;    // Delay between retries in milliseconds
  timeout: number;       // Request timeout in milliseconds
}

export interface HistoryConfig {
  updateInterval: number;  // How often to update historical data
  maxDays: number;        // Maximum number of days to store
}
