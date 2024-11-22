import yahooFinance from 'yahoo-finance2';
import { BaseAsset, HistoricalDataPoint, ProviderConfig } from '../core/types';
import { MarketCache } from '../core/cache';

const DEFAULT_CONFIG: ProviderConfig = {
  retryAttempts: 3,
  retryDelay: 5000,
  timeout: 10000,
};

export class YahooFinanceProvider {
  private cache: MarketCache;
  private config: ProviderConfig;

  constructor(config: Partial<ProviderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = MarketCache.getInstance();
  }

  private async retryWithDelay<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.config.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        }
      }
    }
    
    throw lastError;
  }

  async getQuote(symbol: string): Promise<BaseAsset> {
    const quote = await this.retryWithDelay(() => 
      yahooFinance.quote(symbol, {}, { timeout: this.config.timeout })
    );

    if (!quote) {
      throw new Error(`Failed to fetch quote for symbol: ${symbol}`);
    }

    // Extract values with fallbacks for missing data
    const price = quote.regularMarketPrice || quote.price || quote.ask || quote.bid || 0;
    const previousClose = quote.regularMarketPreviousClose || quote.previousClose || price;
    const change = quote.regularMarketChange || (price - previousClose);
    const percentChange = quote.regularMarketChangePercent || ((change / previousClose) * 100);
    const lastTradeTime = (quote.regularMarketTime || Math.floor(Date.now() / 1000)) * 1000;
    const isOpen = quote.marketState === 'REGULAR' || quote.marketState === 'OPEN';

    // Log warning if we had to use fallback values
    if (!quote.regularMarketPrice) {
      console.warn(`Warning: Using fallback values for symbol ${symbol}. Original quote:`, quote);
    }

    return {
      symbol: quote.symbol || symbol,
      price,
      change,
      percentChange,
      previousClose,
      isOpen,
      lastTradeTime,
    };
  }

  async getHistoricalData(
    symbol: string,
    startDate: Date,
    endDate: Date
  ): Promise<HistoricalDataPoint[]> {
    const history = await this.retryWithDelay(() =>
      yahooFinance.historical(symbol, {
        period1: startDate,
        period2: endDate,
      }, { timeout: this.config.timeout })
    );

    return history.map(day => ({
      timestamp: new Date(day.date).getTime(),
      price: day.close,
      change: day.close - day.open,
      percentChange: ((day.close - day.open) / day.open) * 100,
    }));
  }
}
