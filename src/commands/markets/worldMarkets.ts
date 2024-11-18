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
  isOpen: boolean;
  lastTradeTime: number;
}

interface HistoricalMarketIndex {
  symbol: string;
  price: number;
  change: number;
  percentChange: number;
  previousClose: number;
  lastTradeTime: number;
}

export interface HistoricalWorldMarketData {
  markets: {
    europe: {
      dax: HistoricalMarketIndex;
      ftse100: HistoricalMarketIndex;
      cac40: HistoricalMarketIndex;
    };
    asia: {
      nikkei: HistoricalMarketIndex;
      hang_seng: HistoricalMarketIndex;
      shanghai: HistoricalMarketIndex;
    };
    timestamp: number;
  };
}

const MARKET_HOURS = {
  europe: {
    dax: { timezone: 'Europe/Berlin', open: '09:00', close: '17:30' },
    ftse100: { timezone: 'Europe/London', open: '08:00', close: '16:30' },
    cac40: { timezone: 'Europe/Paris', open: '09:00', close: '17:30' }
  },
  asia: {
    nikkei: { timezone: 'Asia/Tokyo', open: '09:00', close: '15:30' },
    hang_seng: { timezone: 'Asia/Hong_Kong', open: '09:30', close: '16:00' },
    shanghai: { timezone: 'Asia/Shanghai', open: '09:30', close: '15:00' }
  }
};

async function fetchHistoricalData(symbol: string, period1: Date, period2: Date) {
  try {
    const result = await yahooFinance.historical(symbol, {
      period1,
      period2,
      interval: '1d'
    });
    return result;
  } catch (error) {
    console.error(`Error fetching historical data for ${symbol}:`, error);
    return [];
  }
}

export async function updateWorldMarketHistory(days: number = 30): Promise<void> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const symbols = {
    dax: '^GDAXI',
    ftse100: '^FTSE',
    cac40: '^FCHI',
    nikkei: '^N225',
    hang_seng: '^HSI',
    shanghai: '000001.SS'
  };

  const marketDataByDate = new Map<string, HistoricalWorldMarketData>();

  for (const [market, symbol] of Object.entries(symbols)) {
    const history = await fetchHistoricalData(symbol, startDate, endDate);

    for (const day of history) {
      const date = new Date(day.date).toISOString().split('T')[0];
      
      if (!marketDataByDate.has(date)) {
        marketDataByDate.set(date, {
          markets: {
            europe: {
              dax: { symbol: '^GDAXI', price: 0, change: 0, percentChange: 0, previousClose: 0, lastTradeTime: day.date.getTime() },
              ftse100: { symbol: '^FTSE', price: 0, change: 0, percentChange: 0, previousClose: 0, lastTradeTime: day.date.getTime() },
              cac40: { symbol: '^FCHI', price: 0, change: 0, percentChange: 0, previousClose: 0, lastTradeTime: day.date.getTime() }
            },
            asia: {
              nikkei: { symbol: '^N225', price: 0, change: 0, percentChange: 0, previousClose: 0, lastTradeTime: day.date.getTime() },
              hang_seng: { symbol: '^HSI', price: 0, change: 0, percentChange: 0, previousClose: 0, lastTradeTime: day.date.getTime() },
              shanghai: { symbol: '000001.SS', price: 0, change: 0, percentChange: 0, previousClose: 0, lastTradeTime: day.date.getTime() }
            },
            timestamp: day.date.getTime()
          }
        });
      }

      const marketData = marketDataByDate.get(date)!;
      const previousDay = history.find(h => {
        const hDate = new Date(h.date);
        hDate.setDate(hDate.getDate() + 1);
        return hDate.toISOString().split('T')[0] === date;
      });

      // Calculate change and percent change
      const change = previousDay ? day.close - previousDay.close : 0;
      const percentChange = previousDay ? (change / previousDay.close) * 100 : 0;

      // Update the specific market's data
      if (market === 'dax') {
        marketData.markets.europe.dax.price = day.close;
        marketData.markets.europe.dax.change = change;
        marketData.markets.europe.dax.percentChange = percentChange;
        marketData.markets.europe.dax.previousClose = previousDay?.close || 0;
      } else if (market === 'ftse100') {
        marketData.markets.europe.ftse100.price = day.close;
        marketData.markets.europe.ftse100.change = change;
        marketData.markets.europe.ftse100.percentChange = percentChange;
        marketData.markets.europe.ftse100.previousClose = previousDay?.close || 0;
      } else if (market === 'cac40') {
        marketData.markets.europe.cac40.price = day.close;
        marketData.markets.europe.cac40.change = change;
        marketData.markets.europe.cac40.percentChange = percentChange;
        marketData.markets.europe.cac40.previousClose = previousDay?.close || 0;
      } else if (market === 'nikkei') {
        marketData.markets.asia.nikkei.price = day.close;
        marketData.markets.asia.nikkei.change = change;
        marketData.markets.asia.nikkei.percentChange = percentChange;
        marketData.markets.asia.nikkei.previousClose = previousDay?.close || 0;
      } else if (market === 'hang_seng') {
        marketData.markets.asia.hang_seng.price = day.close;
        marketData.markets.asia.hang_seng.change = change;
        marketData.markets.asia.hang_seng.percentChange = percentChange;
        marketData.markets.asia.hang_seng.previousClose = previousDay?.close || 0;
      } else if (market === 'shanghai') {
        marketData.markets.asia.shanghai.price = day.close;
        marketData.markets.asia.shanghai.change = change;
        marketData.markets.asia.shanghai.percentChange = percentChange;
        marketData.markets.asia.shanghai.previousClose = previousDay?.close || 0;
      }
    }
  }

  // Store all market data in the database
  for (const marketData of marketDataByDate.values()) {
    try {
      await worldMarketHistoryDb.addMarketHistory(marketData);
    } catch (error) {
      console.error(`Failed to store market history for ${new Date(marketData.markets.timestamp).toISOString().split('T')[0]}:`, error);
    }
  }
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
            isOpen: daxQuote.marketState === 'REGULAR',
            lastTradeTime: daxQuote.regularMarketTime?.getTime() || Date.now(),
          },
          ftse100: {
            symbol: '^FTSE',
            price: ftseQuote.regularMarketPrice || 0,
            change: ftseQuote.regularMarketChange || 0,
            percentChange: ftseQuote.regularMarketChangePercent || 0,
            previousClose: ftseQuote.regularMarketPreviousClose || 0,
            isOpen: ftseQuote.marketState === 'REGULAR',
            lastTradeTime: ftseQuote.regularMarketTime?.getTime() || Date.now(),
          },
          cac40: {
            symbol: '^FCHI',
            price: cac40Quote.regularMarketPrice || 0,
            change: cac40Quote.regularMarketChange || 0,
            percentChange: cac40Quote.regularMarketChangePercent || 0,
            previousClose: cac40Quote.regularMarketPreviousClose || 0,
            isOpen: cac40Quote.marketState === 'REGULAR',
            lastTradeTime: cac40Quote.regularMarketTime?.getTime() || Date.now(),
          },
        },
        asia: {
          nikkei: {
            symbol: '^N225',
            price: nikkeiQuote.regularMarketPrice || 0,
            change: nikkeiQuote.regularMarketChange || 0,
            percentChange: nikkeiQuote.regularMarketChangePercent || 0,
            previousClose: nikkeiQuote.regularMarketPreviousClose || 0,
            isOpen: nikkeiQuote.marketState === 'REGULAR',
            lastTradeTime: nikkeiQuote.regularMarketTime?.getTime() || Date.now(),
          },
          hang_seng: {
            symbol: '^HSI',
            price: hangSengQuote.regularMarketPrice || 0,
            change: hangSengQuote.regularMarketChange || 0,
            percentChange: hangSengQuote.regularMarketChangePercent || 0,
            previousClose: hangSengQuote.regularMarketPreviousClose || 0,
            isOpen: hangSengQuote.marketState === 'REGULAR',
            lastTradeTime: hangSengQuote.regularMarketTime?.getTime() || Date.now(),
          },
          shanghai: {
            symbol: '000001.SS',
            price: shanghaiQuote.regularMarketPrice || 0,
            change: shanghaiQuote.regularMarketChange || 0,
            percentChange: shanghaiQuote.regularMarketChangePercent || 0,
            previousClose: shanghaiQuote.regularMarketPreviousClose || 0,
            isOpen: shanghaiQuote.marketState === 'REGULAR',
            lastTradeTime: shanghaiQuote.regularMarketTime?.getTime() || Date.now(),
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
      updateWorldMarketHistory().catch(error => {
        console.error('Failed to update historical market data:', error);
      });
    } catch (error) {
      console.error('Failed to store market history:', error);
    }

    return worldMarketData;
  } catch (error) {
    console.error('Error fetching world market data:', error);
    return {
      markets: {
        europe: {
          dax: { symbol: 'DAX', price: 0, change: 0, percentChange: 0, previousClose: 0, isOpen: false, lastTradeTime: Date.now() },
          ftse100: { symbol: 'FTSE 100', price: 0, change: 0, percentChange: 0, previousClose: 0, isOpen: false, lastTradeTime: Date.now() },
          cac40: { symbol: 'CAC 40', price: 0, change: 0, percentChange: 0, previousClose: 0, isOpen: false, lastTradeTime: Date.now() }
        },
        asia: {
          nikkei: { symbol: 'Nikkei 225', price: 0, change: 0, percentChange: 0, previousClose: 0, isOpen: false, lastTradeTime: Date.now() },
          hang_seng: { symbol: 'Hang Seng', price: 0, change: 0, percentChange: 0, previousClose: 0, isOpen: false, lastTradeTime: Date.now() },
          shanghai: { symbol: 'Shanghai Composite', price: 0, change: 0, percentChange: 0, previousClose: 0, isOpen: false, lastTradeTime: Date.now() }
        },
        timestamp: Date.now()
      }
    };
  }
}
