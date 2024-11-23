import yahooFinance from 'yahoo-finance2';
import { BaseAsset, ProviderConfig } from '../core/types';
import { MarketCache } from '../core/cache';

class YahooFinanceError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'YahooFinanceError';
  }
}

const DEFAULT_CONFIG: ProviderConfig = {
  retryAttempts: 3,
  retryDelay: 5000,
  timeout: 10000,
};

export class YahooFinanceProvider {
  private cache: MarketCache;
  private config: ProviderConfig;
  private static CACHE_TTL = 30000; // 30 seconds

  constructor(config: Partial<ProviderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = MarketCache.getInstance();
  }

  private async retryWithDelay<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `Yahoo Finance ${context} - Attempt ${attempt}/${this.config.retryAttempts} failed:`,
          error instanceof Error ? error.message : error
        );
        if (attempt < this.config.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        }
      }
    }

    throw new YahooFinanceError(
      `Failed after ${this.config.retryAttempts} attempts: ${context}`,
      lastError || undefined
    );
  }

  async getQuote(symbol: string): Promise<BaseAsset> {
    if (!symbol || typeof symbol !== 'string') {
      throw new YahooFinanceError(`Invalid symbol: ${symbol}`);
    }

    const cacheKey = `yahoo:${symbol.toUpperCase()}`;
    const cachedData = await this.cache.get<BaseAsset>({ key: cacheKey, duration: YahooFinanceProvider.CACHE_TTL });
    if (cachedData) {
      return cachedData;
    }

    try {
      const quote = await yahooFinance.quote(symbol);

      if (!quote) {
        throw new YahooFinanceError(`Failed to fetch quote for symbol: ${symbol}`);
      }

      // Extract values with fallbacks for missing data
      const price = quote.regularMarketPrice || 0;
      const previousClose = quote.regularMarketPreviousClose || 0;
      const change = quote.regularMarketChange || (price - previousClose);
      const percentChange = quote.regularMarketChangePercent || ((change / previousClose) * 100);
      const isOpen = quote.marketState === 'REGULAR';
      const lastTradeTime = quote.regularMarketTime || new Date();

      // Log warning if we had to use fallback values
      if (!quote.regularMarketPrice) {
        console.warn(`Warning: Using fallback values for symbol ${symbol}. Original quote:`, quote);
      }

      const asset: BaseAsset = {
        symbol: quote.symbol || symbol.toUpperCase(),
        price,
        change,
        percentChange,
        previousClose,
        isOpen,
        lastTradeTime: lastTradeTime.getTime(),
      };

      this.cache.set({ key: cacheKey, duration: YahooFinanceProvider.CACHE_TTL }, asset);
      return asset;
    } catch (error) {
      throw new YahooFinanceError(
        `Failed to fetch quote for ${symbol}`,
        error instanceof Error ? error : undefined
      );
    }
  }
}
