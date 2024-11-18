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
  spy_previous_close: number;
  spy_change: number;
  qqq_price: number;
  qqq_previous_close: number;
  qqq_change: number;
  dia_price: number;
  dia_previous_close: number;
  dia_change: number;
  ten_year_yield: number;
  ten_year_yield_previous_close: number;
  ten_year_yield_change: number;
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
  qqqPrice: number;
  qqqPreviousClose: number;
  qqqChange: number;
  diaPrice: number;
  diaPreviousClose: number;
  diaChange: number;
  tenYearYield: number;
  tenYearYieldPreviousClose: number;
  tenYearYieldChange: number;
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
  try {
    const cachedData = await cacheDb.get('us_markets_data');
    if (cachedData) {
      const cache = JSON.parse(cachedData) as MarketStatusCache;
      if (Date.now() < cache.valid_until) {
        return {
          status: cache.status,
          spyPrice: cache.spy_price,
          spyPreviousClose: cache.spy_previous_close,
          spyChange: cache.spy_change,
          qqqPrice: cache.qqq_price,
          qqqPreviousClose: cache.qqq_previous_close,
          qqqChange: cache.qqq_change,
          diaPrice: cache.dia_price,
          diaPreviousClose: cache.dia_previous_close,
          diaChange: cache.dia_change,
          tenYearYield: cache.ten_year_yield,
          tenYearYieldPreviousClose: cache.ten_year_yield_previous_close,
          tenYearYieldChange: cache.ten_year_yield_change,
          timestamp: cache.timestamp,
        };
      }
    }

    const est = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const hour = est.getHours() + est.getMinutes() / 60;
    const status = getTimeBasedStatus(hour);

    const [spyQuote, qqqQuote, diaQuote, tnxQuote] = await Promise.all([
      yahooFinance.quote('SPY'),
      yahooFinance.quote('QQQ'),
      yahooFinance.quote('DIA'),
      yahooFinance.quote('^TNX'),
    ]);

    // Validate all required data is present
    if (!spyQuote || !qqqQuote || !diaQuote || !tnxQuote) {
      throw new Error('Failed to fetch one or more market symbols');
    }

    const validateQuote = (quote: YahooQuote, symbol: string) => {
      if (quote.regularMarketPrice === undefined || quote.regularMarketPreviousClose === undefined) {
        throw new Error(`Missing required price data for ${symbol}`);
      }
      return {
        price: quote.regularMarketPrice,
        previousClose: quote.regularMarketPreviousClose
      };
    };

    // Validate and extract data for each symbol
    const spy = validateQuote(spyQuote, 'SPY');
    const qqq = validateQuote(qqqQuote, 'QQQ');
    const dia = validateQuote(diaQuote, 'DIA');
    const tnx = validateQuote(tnxQuote, '^TNX');

    // Update historical data
    await updateHistoricalData(spyQuote, tnxQuote, est);

    const spyPrice = spy.price;
    const spyPreviousClose = spy.previousClose;
    const spyChange = ((spyPrice - spyPreviousClose) / spyPreviousClose) * 100;

    const qqqPrice = qqq.price;
    const qqqPreviousClose = qqq.previousClose;
    const qqqChange = ((qqqPrice - qqqPreviousClose) / qqqPreviousClose) * 100;

    const diaPrice = dia.price;
    const diaPreviousClose = dia.previousClose;
    const diaChange = ((diaPrice - diaPreviousClose) / diaPreviousClose) * 100;

    const tenYearYield = tnx.price;
    const tenYearYieldPreviousClose = tnx.previousClose;
    const tenYearYieldChange = tenYearYield - tenYearYieldPreviousClose;

    // Cache all market data
    const cacheData: MarketStatusCache = {
      status,
      spy_price: spyPrice,
      spy_previous_close: spyPreviousClose,
      spy_change: spyChange,
      qqq_price: qqqPrice,
      qqq_previous_close: qqqPreviousClose,
      qqq_change: qqqChange,
      dia_price: diaPrice,
      dia_previous_close: diaPreviousClose,
      dia_change: diaChange,
      ten_year_yield: tenYearYield,
      ten_year_yield_previous_close: tenYearYieldPreviousClose,
      ten_year_yield_change: tenYearYieldChange,
      timestamp: Date.now(),
      valid_until: Date.now() + CACHE_DURATION,
    };
    await cacheDb.set('us_market_status', JSON.stringify(cacheData));

    return {
      status,
      spyPrice,
      spyPreviousClose,
      spyChange,
      qqqPrice,
      qqqPreviousClose,
      qqqChange,
      diaPrice,
      diaPreviousClose,
      diaChange,
      tenYearYield,
      tenYearYieldPreviousClose,
      tenYearYieldChange,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('Error fetching US market data:', error);
    throw error;
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