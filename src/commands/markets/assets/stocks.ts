import { YahooFinanceProvider } from '../providers/yahooFinance';
import { BaseAsset, HistoricalDataPoint } from '../core/types';
import { MarketCache } from '../core/cache';
import { usMarketHistoryDb } from '../../../utils/marketHistory/usMarketHistory';

interface MarketGroup {
  [key: string]: BaseAsset;
}

export interface StockMarketData {
  us: {
    sp500: BaseAsset;
    dow: BaseAsset;
    nasdaq: BaseAsset;
  };
  europe: {
    dax: BaseAsset;
    ftse100: BaseAsset;
    cac40: BaseAsset;
  };
  asia: {
    nikkei: BaseAsset;
    hang_seng: BaseAsset;
    shanghai: BaseAsset;
  };
  timestamp: number;
}

const MARKET_SYMBOLS = {
  us: {
    sp500: '^GSPC',
    dow: '^DJI',
    nasdaq: '^IXIC',
  },
  europe: {
    dax: '^GDAXI',
    ftse100: '^FTSE',
    cac40: '^FCHI',
  },
  asia: {
    nikkei: '^N225',
    hang_seng: '^HSI',
    shanghai: '000001.SS',
  },
};

export class StockMarkets {
  private provider: YahooFinanceProvider;
  private cache: MarketCache;

  constructor() {
    this.provider = new YahooFinanceProvider();
    this.cache = MarketCache.getInstance();
  }

  private async getMarketGroup(
    symbols: { [key: string]: string }
  ): Promise<MarketGroup> {
    const results: MarketGroup = {};
    await Promise.all(
      Object.entries(symbols).map(async ([key, symbol]) => {
        results[key] = await this.provider.getQuote(symbol);
      })
    );
    return results;
  }

  async getMarketData(): Promise<StockMarketData> {
    const [us, europe, asia] = await Promise.all([
      this.getMarketGroup(MARKET_SYMBOLS.us),
      this.getMarketGroup(MARKET_SYMBOLS.europe),
      this.getMarketGroup(MARKET_SYMBOLS.asia),
    ]);

    const timestamp = Date.now();

    // Update US market history
    const date = new Date().toISOString().split('T')[0];
    await usMarketHistoryDb.addMarketHistory({
      date,
      timestamp,
      spy_open: us.sp500.price - us.sp500.change,
      spy_close: us.sp500.price,
      spy_high: us.sp500.price,
      spy_low: us.sp500.price,
      // FIXME: seems like we should be able to get these from the API
      ten_year_yield_open: 0,
      ten_year_yield_close: 0,
      volume: 0,
    });

    return {
      us: us as StockMarketData['us'],
      europe: europe as StockMarketData['europe'],
      asia: asia as StockMarketData['asia'],
      timestamp,
    };
  }

  async getHistoricalData(
    symbol: string,
    days: number
  ): Promise<HistoricalDataPoint[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return await this.provider.getHistoricalData(symbol, startDate, endDate);
  }
}
