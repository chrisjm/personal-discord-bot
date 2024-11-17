export interface USMarketHistoryEntry {
  date: string;
  spy_open: number;
  spy_close: number;
  spy_high: number;
  spy_low: number;
  ten_year_yield_open: number;
  ten_year_yield_close: number;
  volume: number;
  timestamp: number;
}

export interface CryptoMarketHistoryEntry {
  date: string;
  btc_price: number;
  btc_volume: number;
  btc_market_cap: number;
  eth_price: number;
  eth_volume: number;
  eth_market_cap: number;
  timestamp: number;
}

export interface WorldMarketHistoryEntry {
  date: string;
  // Placeholder for future implementation
  timestamp: number;
}
