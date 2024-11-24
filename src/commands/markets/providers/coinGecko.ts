import { CoinGeckoClient } from "coingecko-api-v3";
import { BaseAsset } from "../../../types/markets";
import * as cache from "../../../utils/cacheDatabase";

class CoinGeckoError extends Error {
  constructor(
    message: string,
    public cause?: Error,
  ) {
    super(message);
    this.name = "CoinGeckoError";
  }
}

const CACHE_TTL = 30000; // 30 seconds

const client = new CoinGeckoClient({
  timeout: 10000,
  autoRetry: true,
});

export async function getQuote(coinId: string): Promise<BaseAsset> {
  if (!coinId || typeof coinId !== "string") {
    throw new CoinGeckoError(`Invalid coinId: ${coinId}`);
  }

  const cacheKey = `coingecko:${coinId.toLowerCase()}`;
  const cachedData = await cache.get(cacheKey);
  if (cachedData) {
    return cachedData;
  }

  try {
    const data = await client.simplePrice({
      ids: coinId,
      vs_currencies: "usd",
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
    const percentChange = coinData.usd_24h_change || 0;
    const change = (price * percentChange) / 100;
    const previousClose = price - change;
    const lastTradeTime =
      (coinData.last_updated_at || Math.floor(Date.now() / 1000)) * 1000;

    const asset: BaseAsset = {
      name: coinId,
      symbol: coinId.toUpperCase(),
      price,
      change,
      percentChange,
      previousClose,
      isOpen: true, // Crypto markets are always open
      lastTradeTime,
    };

    cache.set(cacheKey, asset, CACHE_TTL);
    return asset;
  } catch (error) {
    throw new CoinGeckoError(
      `Failed to fetch quote for ${coinId}`,
      error instanceof Error ? error : undefined,
    );
  }
}
