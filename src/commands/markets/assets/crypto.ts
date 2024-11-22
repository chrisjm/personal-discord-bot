import { CoinGeckoProvider } from '../providers/coinGecko';
import { BaseAsset, HistoricalDataPoint } from '../core/types';
import { MarketCache } from '../core/cache';
import { cryptoMarketHistoryDb } from '../../../utils/marketHistory/cryptoMarketHistory';

export interface CryptoMarketData {
  btc: BaseAsset;
  eth: BaseAsset;
  timestamp: number;
}

const CRYPTO_IDS = {
  btc: 'bitcoin',
  eth: 'ethereum',
};

export class CryptoMarkets {
  private provider: CoinGeckoProvider;
  private cache: MarketCache;

  constructor() {
    this.provider = new CoinGeckoProvider();
    this.cache = MarketCache.getInstance();
  }

  async getAssetData(coinId: string): Promise<BaseAsset> {
    return await this.provider.getQuote(coinId);
  }

  async getMarketData(): Promise<CryptoMarketData> {
    const [btc, eth] = await Promise.all([
      this.getAssetData('bitcoin'),
      this.getAssetData('ethereum'),
    ]);

    const timestamp = Date.now();

    // Update crypto market history
    const date = new Date().toISOString().split('T')[0];
    await cryptoMarketHistoryDb.addMarketHistory({
      date,
      btc_price: btc.price,
      btc_volume: btc.volume,
      btc_market_cap: btc.marketCap || 0,
      eth_price: eth.price,
      eth_volume: eth.volume,
      eth_market_cap: eth.marketCap || 0,
      timestamp,
    });

    return {
      btc,
      eth,
      timestamp,
    };
  }

  async getHistoricalData(
    coinId: string,
    days: number
  ): Promise<HistoricalDataPoint[]> {
    return await this.provider.getHistoricalData(coinId, days);
  }
}
