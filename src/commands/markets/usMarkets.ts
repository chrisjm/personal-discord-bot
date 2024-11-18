import yahooFinance from 'yahoo-finance2';
import { cacheDb } from "../../utils/database";
import { usMarketHistoryDb } from "../../utils/marketHistory";

// Market hours in EST
const marketHours = {
  preMarket: { start: 4, end: 9.5 }, // 4:00 AM - 9:30 AM
  regular: { start: 9.5, end: 16 },  // 9:30 AM - 4:00 PM
  afterHours: { start: 16, end: 20 }, // 4:00 PM - 8:00 PM
};

const CACHE_DURATION = 60 * 1000; // 1 minute cache

interface MarketStatusCache {
  status: string;
  spy_price: number;
  ten_year_yield: number;
  timestamp: number;
  valid_until: number;
}

interface YahooQuote {
  marketState?: 'PRE' | 'REGULAR' | 'POST' | 'CLOSED';
  regularMarketPrice?: number;
  regularMarketPreviousClose?: number;
  regularMarketOpen?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
}

export interface USMarketData {
  status: string;
  spyPrice: number;
  spyPreviousClose: number;
  spyChange: number;
  tenYearYield: number;
  timestamp: number;
}

function getTimeBasedStatus(hour: number): string {
  if (hour < marketHours.preMarket.start || hour >= marketHours.afterHours.end) {
    return "US Markets are closed";
  } else if (hour < marketHours.regular.start) {
    return "Pre-market trading session";
  } else if (hour < marketHours.regular.end) {
    return "Regular trading session";
  } else {
    return "After-hours trading session";
  }
}

export async function getUSMarketData(): Promise<USMarketData> {
  const now = Date.now();
  const est = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = est.getDay();
  const hour = est.getHours() + est.getMinutes() / 60;
  
  const cacheKey = 'us_markets_data';
  const cachedData = await cacheDb.get(cacheKey);

  if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
    return cachedData;
  }

  // Weekend check
  if (day === 0 || day === 6) {
    try {
      const [spyQuote, tnxQuote] = await Promise.all([
        yahooFinance.quote('SPY'),
        yahooFinance.quote('^TNX')
      ]) as [YahooQuote, YahooQuote];

      if (!spyQuote.regularMarketPrice || !spyQuote.regularMarketPreviousClose || !tnxQuote.regularMarketPrice) {
        throw new Error('Missing required market data');
      }

      // Update historical data
      await updateHistoricalData(spyQuote, tnxQuote, est);

      const data: USMarketData = {
        status: "US Markets are closed (Weekend)",
        spyPrice: spyQuote.regularMarketPrice,
        spyPreviousClose: spyQuote.regularMarketPreviousClose,
        spyChange: ((spyQuote.regularMarketPrice - spyQuote.regularMarketPreviousClose) / spyQuote.regularMarketPreviousClose) * 100,
        tenYearYield: tnxQuote.regularMarketPrice,
        timestamp: now
      };

      await cacheDb.set(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error fetching weekend market data:', error);
      if (cachedData) {
        return cachedData;
      }
      return {
        status: "US Markets are closed (Weekend)",
        spyPrice: 0,
        spyPreviousClose: 0,
        spyChange: 0,
        tenYearYield: 0,
        timestamp: now
      };
    }
  }

  try {
    const [spyQuote, tnxQuote] = await Promise.all([
      yahooFinance.quote('SPY'),
      yahooFinance.quote('^TNX')
    ]) as [YahooQuote, YahooQuote];

    if (!spyQuote.regularMarketPrice || !spyQuote.regularMarketPreviousClose || !tnxQuote.regularMarketPrice) {
      throw new Error('Missing required market data');
    }

    // Update historical data
    await updateHistoricalData(spyQuote, tnxQuote, est);

    const data: USMarketData = {
      status: spyQuote.marketState === 'REGULAR' ? "Regular trading session" : getTimeBasedStatus(hour),
      spyPrice: spyQuote.regularMarketPrice,
      spyPreviousClose: spyQuote.regularMarketPreviousClose,
      spyChange: ((spyQuote.regularMarketPrice - spyQuote.regularMarketPreviousClose) / spyQuote.regularMarketPreviousClose) * 100,
      tenYearYield: tnxQuote.regularMarketPrice,
      timestamp: now
    };

    await cacheDb.set(cacheKey, data);
    return data;
  } catch (error) {
    console.error('Error fetching market data:', error);
    if (cachedData) {
      return cachedData;
    }
    return {
      status: getTimeBasedStatus(hour),
      spyPrice: 0,
      spyPreviousClose: 0,
      spyChange: 0,
      tenYearYield: 0,
      timestamp: now
    };
  }
}

async function updateHistoricalData(
  spyQuote: YahooQuote,
  tnxQuote: YahooQuote,
  est: Date
) {
  const now = Date.now();
  const today = est.toISOString().split('T')[0];

  // Only include US market data if markets are closed and we have all required data
  if (spyQuote.marketState === 'CLOSED' &&
      spyQuote.regularMarketOpen !== undefined &&
      spyQuote.regularMarketDayHigh !== undefined &&
      spyQuote.regularMarketDayLow !== undefined &&
      spyQuote.regularMarketVolume !== undefined &&
      tnxQuote.regularMarketOpen !== undefined &&
      spyQuote.regularMarketPreviousClose !== undefined &&
      tnxQuote.regularMarketPreviousClose !== undefined) {

    await usMarketHistoryDb.addMarketHistory({
      date: today,
      spy_open: spyQuote.regularMarketOpen,
      spy_close: spyQuote.regularMarketPreviousClose,
      spy_high: spyQuote.regularMarketDayHigh,
      spy_low: spyQuote.regularMarketDayLow,
      ten_year_yield_open: tnxQuote.regularMarketOpen,
      ten_year_yield_close: tnxQuote.regularMarketPreviousClose,
      volume: spyQuote.regularMarketVolume,
      timestamp: now
    });
  }
}

export async function loadUSHistoricalData() {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    // Format dates for Yahoo Finance
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];

    // Get existing dates in our database
    const existingData = await usMarketHistoryDb.getLatestMarketHistory(30);
    const existingDates = new Set(existingData.map(entry => entry.date));

    // Fetch historical data from Yahoo Finance
    const [spyHistory, tnxHistory] = await Promise.all([
      yahooFinance.historical('SPY', {
        period1: startDate,
        period2: endDate,
        interval: '1d'
      }),
      yahooFinance.historical('^TNX', {
        period1: startDate,
        period2: endDate,
        interval: '1d'
      })
    ]);

    // Create a map of dates to TNX data for easier lookup
    const tnxDataMap = new Map(
      tnxHistory.map(day => [day.date.toISOString().split('T')[0], day])
    );

    // Process and store each day's data
    for (const spyDay of spyHistory) {
      const date = spyDay.date.toISOString().split('T')[0];

      // Skip if we already have this date
      if (existingDates.has(date)) {
        continue;
      }

      const tnxDay = tnxDataMap.get(date);
      if (!tnxDay) {
        continue; // Skip if we don't have TNX data for this day
      }

      await usMarketHistoryDb.addMarketHistory({
        date,
        spy_open: spyDay.open,
        spy_close: spyDay.close,
        spy_high: spyDay.high,
        spy_low: spyDay.low,
        ten_year_yield_open: tnxDay.open,
        ten_year_yield_close: tnxDay.close,
        volume: spyDay.volume,
        timestamp: spyDay.date.getTime()
      });
    }

    console.log('US Market historical data load completed');
  } catch (error) {
    console.error('Error loading US Market historical data:', error);
  }
}
