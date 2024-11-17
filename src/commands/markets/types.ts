export interface MarketState {
  marketState?: 'PRE' | 'REGULAR' | 'POST' | 'CLOSED';
  regularMarketPrice: number;
  regularMarketPreviousClose: number;
  regularMarketOpen?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
}
