import { getQuote } from "../providers/coinGecko";
import { BaseAsset } from "../../../types/markets";
import { CURRENCY_SYMBOLS } from "..";

export interface CryptoMarketData {
  data: BaseAsset[];
  timestamp: number;
}

export const CRYPTO_IDS = {
  btc: "bitcoin",
  eth: "ethereum",
} as const;

export async function getMarketData(): Promise<CryptoMarketData> {
  const [btc, eth] = await Promise.all([
    getQuote(CRYPTO_IDS.btc),
    getQuote(CRYPTO_IDS.eth),
  ]);

  const timestamp = Date.now();

  // Override the names with their symbols
  btc.name = CURRENCY_SYMBOLS.BTC;
  eth.name = CURRENCY_SYMBOLS.ETH;

  return {
    data: [btc, eth],
    timestamp,
  };
}
