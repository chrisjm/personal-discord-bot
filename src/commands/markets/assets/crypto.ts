import { getQuote } from "../providers/coinGecko";
import { CURRENCY_SYMBOLS } from "..";
import { CategoryData } from "./traditional";

export interface CryptoMarketData {
  coins: CategoryData;
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

  // Override the names with their symbols
  btc.name = CURRENCY_SYMBOLS.BTC;
  eth.name = CURRENCY_SYMBOLS.ETH;

  return {
    coins: {
      name: "Cryptocurrencies",
      data: [btc, eth],
    },
  };
}
