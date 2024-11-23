import { CoinGeckoProvider } from '../providers/coinGecko';
import { BaseAsset } from '../core/types';

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

  constructor() {
    this.provider = new CoinGeckoProvider();
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

    return {
      btc,
      eth,
      timestamp,
    };
  }
}
