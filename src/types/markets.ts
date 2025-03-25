// NOTE: Keep this for future use even though it's not currently used.

export interface MarketState {
  marketState?: "PRE" | "REGULAR" | "POST" | "CLOSED";
  regularMarketPrice: number;
  regularMarketPreviousClose: number;
  regularMarketOpen?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
}

export interface BaseAsset {
  name: string;
  symbol: string;
  price: number;
  change: number;
  percentChange: number;
  previousClose: number;
  isOpen: boolean;
  lastTradeTime: number;
  currency?: string; // The currency of the asset (e.g., USD, EUR)
  exchangeRate?: number; // Exchange rate to USD if not in USD
  priceUSD?: number; // Price in USD for easy comparison
}

export interface CacheConfig {
  duration: number; // Cache duration in milliseconds
  key: string; // Cache key for the data
}

export interface ProviderConfig {
  retryAttempts: number;
  retryDelay: number; // Delay between retries in milliseconds
  timeout: number; // Request timeout in milliseconds
}
