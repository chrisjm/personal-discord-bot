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

export class CoinGeckoProvider {
  private client: CoinGeckoClient;
  private cache: MarketCache;
  private config: ProviderConfig;
  private static CACHE_TTL = 30000; // 30 seconds

  constructor(config: Partial<ProviderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.client = new CoinGeckoClient({
      timeout: this.config.timeout,
      autoRetry: true,
    });
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
          `CoinGecko ${context} - Attempt ${attempt}/${this.config.retryAttempts} failed:`,
          error instanceof Error ? error.message : error
        );
        if (attempt < this.config.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        }
      }
    }

    throw new CoinGeckoError(
      `Failed after ${this.config.retryAttempts} attempts: ${context}`,
      lastError || undefined
    );
  }

  async getQuote(coinId: string): Promise<BaseAsset> {
    if (!coinId || typeof coinId !== 'string') {
      throw new CoinGeckoError(`Invalid coinId: ${coinId}`);
    }

    const cacheKey = `coingecko:${coinId.toLowerCase()}`;
    const cachedData = await this.cache.get<BaseAsset>({ key: cacheKey, duration: CoinGeckoProvider.CACHE_TTL });
    if (cachedData) {
      return cachedData;
    }

    try {
      const data = await this.retryWithDelay(
        () =>
          this.client.simplePrice({
            ids: coinId,
            vs_currencies: 'usd',
            include_24hr_vol: true,
            include_24hr_change: true,
            include_last_updated_at: true,
            include_market_cap: true,
          }),
        `fetching price for ${coinId}`
      );

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

      await this.cache.set<BaseAsset>(
        {
          key: cacheKey,
          duration: CoinGeckoProvider.CACHE_TTL
        },
        {
          symbol: coinId,
          price: data[coinId].usd,
          change: data[coinId].usd_24h_change || 0,
          percentChange: (data[coinId].usd_24h_change || 0),
          previousClose: 0, // CoinGecko doesn't provide previous close
          isOpen: true,
          lastTradeTime: Date.now()
        }
      );

      const asset: BaseAsset = {
        symbol: coinId.toUpperCase(),
        price,
        change,
        percentChange,
        previousClose,
        isOpen: true, // Crypto markets are always open
        lastTradeTime
      };

      this.cache.set({ key: cacheKey, duration: CoinGeckoProvider.CACHE_TTL }, asset);
      return asset;
    } catch (error) {
      throw new CoinGeckoError(
        `Failed to fetch quote for ${coinId}`,
        error instanceof Error ? error : undefined
      );
    }
  }
}
