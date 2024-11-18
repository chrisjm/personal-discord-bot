import yahooFinance from 'yahoo-finance2';
import { cacheDb } from "../../utils/database";
import { worldMarketHistoryDb } from "../../utils/marketHistory/worldMarketHistory";

const CACHE_DURATION = 60 * 1000; // 1 minute cache

export interface WorldMarketData {
  markets: {
    europe: {
      dax: MarketIndex;
      ftse100: MarketIndex;
      cac40: MarketIndex;
    };
    asia: {
      nikkei: MarketIndex;
      hang_seng: MarketIndex;
      shanghai: MarketIndex;
    };
    timestamp: number;
  };
}

interface MarketIndex {
  symbol: string;
  price: number;
  change: number;
  percentChange: number;
  previousClose: number;
}

export async function getWorldMarketData(): Promise<WorldMarketData> {
  const cacheKey = 'world_markets_data';
  const cachedData = await cacheDb.get(cacheKey);

  if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
    return cachedData;
  }

  try {
    // European Indices
    const daxQuote = await yahooFinance.quote('^GDAXI');
    const ftseQuote = await yahooFinance.quote('^FTSE');
    const cac40Quote = await yahooFinance.quote('^FCHI');

    // Asian Indices
    const nikkeiQuote = await yahooFinance.quote('^N225');
    const hangSengQuote = await yahooFinance.quote('^HSI');
    const shanghaiQuote = await yahooFinance.quote('000001.SS');

    const worldMarketData: WorldMarketData = {
      markets: {
        europe: {
          dax: {
            symbol: '^GDAXI',
            price: daxQuote.regularMarketPrice || 0,
            change: daxQuote.regularMarketChange || 0,
            percentChange: daxQuote.regularMarketChangePercent || 0,
            previousClose: daxQuote.regularMarketPreviousClose || 0,
          },
          ftse100: {
            symbol: '^FTSE',
            price: ftseQuote.regularMarketPrice || 0,
            change: ftseQuote.regularMarketChange || 0,
            percentChange: ftseQuote.regularMarketChangePercent || 0,
            previousClose: ftseQuote.regularMarketPreviousClose || 0,
          },
          cac40: {
            symbol: '^FCHI',
            price: cac40Quote.regularMarketPrice || 0,
            change: cac40Quote.regularMarketChange || 0,
            percentChange: cac40Quote.regularMarketChangePercent || 0,
            previousClose: cac40Quote.regularMarketPreviousClose || 0,
          },
        },
        asia: {
          nikkei: {
            symbol: '^N225',
            price: nikkeiQuote.regularMarketPrice || 0,
            change: nikkeiQuote.regularMarketChange || 0,
            percentChange: nikkeiQuote.regularMarketChangePercent || 0,
            previousClose: nikkeiQuote.regularMarketPreviousClose || 0,
          },
          hang_seng: {
            symbol: '^HSI',
            price: hangSengQuote.regularMarketPrice || 0,
            change: hangSengQuote.regularMarketChange || 0,
            percentChange: hangSengQuote.regularMarketChangePercent || 0,
            previousClose: hangSengQuote.regularMarketPreviousClose || 0,
          },
          shanghai: {
            symbol: '000001.SS',
            price: shanghaiQuote.regularMarketPrice || 0,
            change: shanghaiQuote.regularMarketChange || 0,
            percentChange: shanghaiQuote.regularMarketChangePercent || 0,
            previousClose: shanghaiQuote.regularMarketPreviousClose || 0,
          },
        },
        timestamp: Date.now(),
      },
    };

    // Cache the result
    await cacheDb.set(cacheKey, worldMarketData);

    // Store in market history database
    try {
      await worldMarketHistoryDb.addMarketHistory(worldMarketData);
    } catch (error) {
      console.error('Failed to store market history:', error);
      // Don't throw the error as this is a non-critical operation
    }

    return worldMarketData;
  } catch (error) {
    console.error('Error fetching world market data:', error);
    return {
      markets: {
        europe: {
          dax: { symbol: 'DAX', price: 0, change: 0, percentChange: 0, previousClose: 0 },
          ftse100: { symbol: 'FTSE 100', price: 0, change: 0, percentChange: 0, previousClose: 0 },
          cac40: { symbol: 'CAC 40', price: 0, change: 0, percentChange: 0, previousClose: 0 }
        },
        asia: {
          nikkei: { symbol: 'Nikkei 225', price: 0, change: 0, percentChange: 0, previousClose: 0 },
          hang_seng: { symbol: 'Hang Seng', price: 0, change: 0, percentChange: 0, previousClose: 0 },
          shanghai: { symbol: 'Shanghai Composite', price: 0, change: 0, percentChange: 0, previousClose: 0 }
        },
        timestamp: Date.now()
      }
    };
  }
}
