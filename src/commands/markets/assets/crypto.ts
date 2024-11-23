import { getQuote } from '../providers/coinGecko';
import { BaseAsset } from '../core/types';

export interface CryptoMarketData {
  data: BaseAsset[];
  timestamp: number;
}

const CRYPTO_IDS = {
  btc: 'bitcoin',
  eth: 'ethereum',
} as const;

export async function getMarketData(): Promise<CryptoMarketData> {
  const [btc, eth] = await Promise.all([
    getQuote(CRYPTO_IDS.btc),
    getQuote(CRYPTO_IDS.eth),
  ]);

  const timestamp = Date.now();

  return {
    data: [btc, eth],
    timestamp,
  };
}
