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

const CACHE_TTL = 30000; // 30 seconds

export async function getQuote(
  symbol: string,
  config: Partial<ProviderConfig> = {}
): Promise<BaseAsset> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const cache = MarketCache.getInstance();

  if (!symbol || typeof symbol !== 'string') {
    throw new YahooFinanceError(`Invalid symbol: ${symbol}`);
  }

  const cacheKey = `yahoo:${symbol.toUpperCase()}`;
  const cachedData = await cache.get<BaseAsset>({ key: cacheKey, duration: CACHE_TTL });
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

    cache.set({ key: cacheKey, duration: CACHE_TTL }, asset);
    return asset;
  } catch (error) {
    throw new YahooFinanceError(
      `Failed to fetch quote for ${symbol}`,
      error instanceof Error ? error : undefined
    );
  }
}
