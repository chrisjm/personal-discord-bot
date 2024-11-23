import { YahooFinanceProvider } from '../providers/yahooFinance';
import { BaseAsset } from '../core/types';

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

  constructor() {
    this.provider = new YahooFinanceProvider();
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

    return {
      us: us as StockMarketData['us'],
      europe: europe as StockMarketData['europe'],
      asia: asia as StockMarketData['asia'],
      timestamp,
    };
  }
}
