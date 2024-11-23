import { CoinGeckoClient } from 'coingecko-api-v3';
import { BaseAsset, ProviderConfig } from '../core/types';
import { MarketCache } from '../core/cache';

class CoinGeckoError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'CoinGeckoError';
  }
}

const DEFAULT_CONFIG: ProviderConfig = {
  retryAttempts: 3,
  retryDelay: 5000,
  timeout: 10000,
};

const CACHE_TTL = 30000; // 30 seconds

const client = new CoinGeckoClient({
  timeout: DEFAULT_CONFIG.timeout,
  autoRetry: true,
});

export async function getQuote(
  coinId: string,
  config: Partial<ProviderConfig> = {}
): Promise<BaseAsset> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const cache = MarketCache.getInstance();

  if (!coinId || typeof coinId !== 'string') {
    throw new CoinGeckoError(`Invalid coinId: ${coinId}`);
  }

  const cacheKey = `coingecko:${coinId.toLowerCase()}`;
  const cachedData = await cache.get<BaseAsset>({ key: cacheKey, duration: CACHE_TTL });
  if (cachedData) {
    return cachedData;
  }

  try {
    const data = await client.simplePrice({
      ids: coinId,
      vs_currencies: 'usd',
      include_24hr_vol: true,
      include_24hr_change: true,
      include_last_updated_at: true,
      include_market_cap: true,
    });

    if (!data || !data[coinId]) {
      throw new CoinGeckoError(`No data returned for coin: ${coinId}`);
    }

    const coinData = data[coinId];
    if (!coinData.usd) {
      throw new CoinGeckoError(`No price data for coin: ${coinId}`);
    }

    const price = coinData.usd;
    const volume = coinData.usd_24h_vol || 0;
    const percentChange = coinData.usd_24h_change || 0;
    const marketCap = coinData.usd_market_cap || 0;
    const change = (price * percentChange) / 100;
    const previousClose = price - change;
    const lastTradeTime = (coinData.last_updated_at || Math.floor(Date.now() / 1000)) * 1000;

    const asset: BaseAsset = {
      symbol: coinId.toUpperCase(),
      price,
      change,
      percentChange,
      previousClose,
      isOpen: true, // Crypto markets are always open
      lastTradeTime
    };

    cache.set({ key: cacheKey, duration: CACHE_TTL }, asset);
    return asset;
  } catch (error) {
    throw new CoinGeckoError(
      `Failed to fetch quote for ${coinId}`,
      error instanceof Error ? error : undefined
    );
  }
}
