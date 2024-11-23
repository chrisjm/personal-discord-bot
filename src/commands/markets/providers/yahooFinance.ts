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
const EXCHANGE_RATE_CACHE_TTL = 3600000; // 1 hour

async function getExchangeRate(currency: string): Promise<number> {
  if (!currency || currency === 'USD') return 1;

  const cache = MarketCache.getInstance();
  const cacheKey = `yahoo:exchange:${currency}USD`;
  
  const cachedRate = await cache.get<number>({ key: cacheKey, duration: EXCHANGE_RATE_CACHE_TTL });
  if (cachedRate) {
    return cachedRate;
  }

  try {
    // Use Yahoo Finance to get exchange rate by querying the currency pair
    const quote = await yahooFinance.quote(`${currency}USD=X`);
    if (!quote || !quote.regularMarketPrice) {
      console.warn(`Failed to fetch exchange rate for ${currency}, using 1.0`);
      return 1;
    }

    const rate = quote.regularMarketPrice;
    cache.set({ key: cacheKey, duration: EXCHANGE_RATE_CACHE_TTL }, rate);
    return rate;
  } catch (error) {
    console.warn(`Error fetching exchange rate for ${currency}:`, error);
    return 1;
  }
}

export async function getQuote(
  symbol: string,
  config: Partial<ProviderConfig> = {}
): Promise<BaseAsset> {
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
      name: quote.shortName || symbol.toUpperCase(),
      symbol: quote.symbol || symbol.toUpperCase(),
      price,
      change,
      percentChange,
      previousClose,
      isOpen,
      lastTradeTime: lastTradeTime.getTime(),
      currency: quote.currency || 'USD',
      exchangeRate: quote.currency && quote.currency !== 'USD' ? 
        await getExchangeRate(quote.currency) : 1,
    };

    // Add USD price if not in USD
    if (asset.currency !== 'USD' && asset.exchangeRate) {
      asset.priceUSD = asset.price * asset.exchangeRate;
    }

    cache.set({ key: cacheKey, duration: CACHE_TTL }, asset);
    return asset;
  } catch (error) {
    throw new YahooFinanceError(
      `Failed to fetch quote for ${symbol}`,
      error instanceof Error ? error : undefined
    );
  }
}
