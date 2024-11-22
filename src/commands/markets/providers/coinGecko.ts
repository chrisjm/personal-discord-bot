import { CoinGeckoClient } from 'coingecko-api-v3';
import { BaseAsset, HistoricalDataPoint, ProviderConfig } from '../core/types';
import { MarketCache } from '../core/cache';

const DEFAULT_CONFIG: ProviderConfig = {
  retryAttempts: 3,
  retryDelay: 5000,
  timeout: 10000,
};

export class CoinGeckoProvider {
  private client: CoinGeckoClient;
  private cache: MarketCache;
  private config: ProviderConfig;

  constructor(config: Partial<ProviderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.client = new CoinGeckoClient({
      timeout: this.config.timeout,
      autoRetry: true,
    });
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
        console.warn(`Attempt ${attempt} failed:`, error);
        if (attempt < this.config.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        }
      }
    }

    throw lastError;
  }

  async getQuote(coinId: string): Promise<BaseAsset> {
    const data = await this.retryWithDelay(() =>
      this.client.simplePrice({
        ids: coinId,
        vs_currencies: 'usd',
        include_24hr_vol: true,
        include_24hr_change: true,
        include_last_updated_at: true,
        include_market_cap: true,
      })
    );

    if (!data || !data[coinId]) {
      throw new Error(`No data returned for coin: ${coinId}`);
    }

    const coinData = data[coinId];
    if (!coinData.usd) {
      throw new Error(`No price data for coin: ${coinId}`);
    }

    const price = coinData.usd;
    const volume = coinData.usd_24h_vol || 0;
    const percentChange = coinData.usd_24h_change || 0;
    const marketCap = coinData.usd_market_cap || 0;
    const change = (price * percentChange) / 100;
    const previousClose = price - change;
    const lastTradeTime = (coinData.last_updated_at || Math.floor(Date.now() / 1000)) * 1000;

    return {
      symbol: coinId.toUpperCase(),
      price,
      change,
      percentChange,
      previousClose,
      isOpen: true, // Crypto markets are always open
      lastTradeTime,
      volume,
      marketCap,
    };
  }

  async getHistoricalData(
    coinId: string,
    days: number
  ): Promise<HistoricalDataPoint[]> {
    const data = await this.retryWithDelay(() =>
      this.client.coinIdMarketChart({
        id: coinId,
        vs_currency: 'usd',
        days: days,
      })
    );

    if (!data?.prices?.length) {
      throw new Error(`No historical data returned for coin: ${coinId}`);
    }

    return data.prices.map(([timestamp, price], index) => {
      const prevPrice = index > 0 ? data.prices[index - 1][1] : price;
      const change = price - prevPrice;
      return {
        timestamp,
        price,
        change,
        percentChange: (change / prevPrice) * 100,
      };
    });
  }
}
