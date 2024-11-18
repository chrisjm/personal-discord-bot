import { CoinGeckoClient, SimplePriceResponse, CoinFullInfo } from 'coingecko-api-v3';
import { cryptoMarketHistoryDb } from "../../utils/marketHistory";
import { cacheDb } from "../../utils/database";

const coinGeckoClient = new CoinGeckoClient({
  timeout: 10000,
  autoRetry: true,
});
const HISTORY_UPDATE_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours
const CACHE_DURATION = 60 * 1000; // 1 minute cache
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds
let lastHistoryUpdate = 0;

export interface CryptoMarketData {
  btcPrice: number;
  btcChange24h: number;
  ethPrice: number;
  ethChange24h: number;
  timestamp: number;
}

interface CoinGeckoMarketData {
  usd: number;
  usd_24h_change: number;
  usd_24h_vol?: number;
  usd_market_cap?: number;
}

interface ValidatedResponse<T> {
  data: T;
}

async function retryWithDelay<T>(
  operation: () => Promise<T>,
  retries = MAX_RETRIES,
  delay = RETRY_DELAY
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (retries > 0) {
      console.log(`Retrying operation after ${delay}ms, ${retries} retries left`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithDelay(operation, retries - 1, delay * 2);
    }
    throw error;
  }
}

async function validateCoinGeckoResponse<T>(response: any): Promise<ValidatedResponse<T>> {
  if (!response) {
    throw new Error('Invalid response format from CoinGecko');
  }

  // Check if response is HTML (indicating an error page)
  if (typeof response === 'string' && response.includes('<!DOCTYPE')) {
    throw new Error('Received HTML response from CoinGecko - possible rate limiting');
  }

  return { data: response };
}

export async function getCryptoMarketData(): Promise<CryptoMarketData> {
  try {
    const now = Date.now();
    const cacheKey = 'crypto_markets_data';
    const cachedData = await cacheDb.get(cacheKey);

    if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
      return cachedData;
    }

    // Get simple price data for quick updates
    const response = await retryWithDelay(async () => {
      const resp = await coinGeckoClient.simplePrice({
        ids: 'bitcoin,ethereum',
        vs_currencies: 'usd',
        include_24hr_change: true
      });
      return validateCoinGeckoResponse<SimplePriceResponse>(resp);
    });

    if (!response?.data?.bitcoin?.usd || !response?.data?.ethereum?.usd) {
      throw new Error('Missing price data from CoinGecko');
    }

    const btcData = response.data.bitcoin;
    const ethData = response.data.ethereum;

    // Update historical data periodically
    if (now - lastHistoryUpdate >= HISTORY_UPDATE_INTERVAL) {
      updateHistoricalData().catch(error => {
        console.error('Error updating historical data:', error);
      });
      lastHistoryUpdate = now;
    }

    const marketData: CryptoMarketData = {
      btcPrice: btcData.usd,
      btcChange24h: btcData.usd_24h_change,
      ethPrice: ethData.usd,
      ethChange24h: ethData.usd_24h_change,
      timestamp: now
    };

    await cacheDb.set(cacheKey, marketData);
    return marketData;
  } catch (error) {
    console.error('Error fetching crypto market data:', error);

    // If no cache available, return zeros
    return {
      btcPrice: 0,
      btcChange24h: 0,
      ethPrice: 0,
      ethChange24h: 0,
      timestamp: Date.now()
    };
  }
}

async function updateHistoricalData(): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Check if we already have data for today
    const hasData = await cryptoMarketHistoryDb.hasDataForDate(today);
    if (hasData) {
      return;
    }

    // Get detailed market data for historical storage
    const response = await retryWithDelay(async () => {
      const resp = await coinGeckoClient.coinMarket({
        ids: 'bitcoin,ethereum',
        vs_currency: 'usd',
        order: 'market_cap_desc',
        per_page: 2,
        page: 1,
        sparkline: false
      });
      return validateCoinGeckoResponse(resp);
    });

    if (!Array.isArray(response.data) || response.data.length < 2) {
      throw new Error('Invalid market data from CoinGecko');
    }

    const btcData = response.data.find(coin => coin.id === 'bitcoin');
    const ethData = response.data.find(coin => coin.id === 'ethereum');

    if (!btcData || !ethData) {
      throw new Error('Missing coin data from CoinGecko');
    }

    await cryptoMarketHistoryDb.addMarketHistory({
      date: today,
      btc_price: btcData.current_price,
      btc_volume: Number(btcData.total_volume) || 0,
      btc_market_cap: Number(btcData.market_cap) || 0,
      eth_price: ethData.current_price,
      eth_volume: Number(ethData.total_volume) || 0,
      eth_market_cap: Number(ethData.market_cap) || 0,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error updating crypto historical data:', error);
    throw error;
  }
}

export async function loadCryptoHistoricalData() {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    // Get historical market data
    const response = await retryWithDelay(async () => {
      const [btcResp, ethResp] = await Promise.all([
        coinGeckoClient.coinIdMarketChart({
          id: 'bitcoin',
          vs_currency: 'usd',
          days: 30
        }),
        coinGeckoClient.coinIdMarketChart({
          id: 'ethereum',
          vs_currency: 'usd',
          days: 30
        })
      ]);
      return {
        btcData: await validateCoinGeckoResponse<CoinFullInfo>(btcResp),
        ethData: await validateCoinGeckoResponse<CoinFullInfo>(ethResp)
      };
    });

    if (!response.btcData || !response.ethData) {
      throw new Error('Invalid historical data from CoinGecko');
    }

    const btcPrices = response.btcData.data.prices;
    const ethPrices = response.ethData.data.prices;

    // Process each day's data
    const days = 30;
    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // Skip if we already have data for this date
      const hasData = await cryptoMarketHistoryDb.hasDataForDate(dateStr);
      if (hasData) continue;

      await cryptoMarketHistoryDb.addMarketHistory({
        date: dateStr,
        btc_price: btcPrices[i][1] || 0,
        btc_volume: response.btcData.data.total_volumes[i]?.[1] || 0,
        btc_market_cap: response.btcData.data.market_caps[i]?.[1] || 0,
        eth_price: ethPrices[i][1] || 0,
        eth_volume: response.ethData.data.total_volumes[i]?.[1] || 0,
        eth_market_cap: response.ethData.data.market_caps[i]?.[1] || 0,
        timestamp: date.getTime()
      });
    }
  } catch (error) {
    console.error('Error loading crypto historical data:', error);
    throw error;
  }
}
