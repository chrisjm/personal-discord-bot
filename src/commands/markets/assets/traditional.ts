import { getQuote } from "../providers/yahooFinance";
import { BaseAsset } from "../core/types";

// Map Yahoo Finance symbols to friendly names
const NAME_MAP = {
  // US Markets
  "^GSPC": "S&P 500",
  "^DJI": "Dow Jones",
  "^IXIC": "NASDAQ",

  // European Markets
  "^GDAXI": "DAX",
  "^FTSE": "FTSE 100",
  "^FCHI": "CAC 40",

  // Asian Markets
  "^N225": "Nikkei 225",
  "^HSI": "Hang Seng",
  "000001.SS": "Shanghai",

  // Forex
  "USDEUR=X": "USD/EUR",
  "USDJPY=X": "USD/JPY",
  "USDGBP=X": "USD/GBP",
  "USDAUD=X": "USD/AUD",
  "USDCAD=X": "USD/CAD",

  // Government Bonds
  "^TNX": "US 10Y",
  "^BUND": "GER 10Y",
  "^GBGY": "UK 10Y",
} as const;

// Type for market categories
type MarketCategory = {
  name: string;
  assets: string[];
};

// Define market structure with symbols
const MARKET_STRUCTURE = {
  stocks: {
    us: {
      name: "US Markets",
      assets: ["^GSPC", "^DJI", "^IXIC"],
    },
    europe: {
      name: "European Markets",
      assets: ["^GDAXI", "^FTSE", "^FCHI"],
    },
    asia: {
      name: "Asian Markets",
      assets: ["^N225", "^HSI", "000001.SS"],
    },
  },
  forex: {
    name: "Exchange Rates",
    assets: ["USDEUR=X", "USDJPY=X", "USDGBP=X", "USDAUD=X", "USDCAD=X"],
  },
  bonds: {
    name: "Treasury Notes",
    assets: ["^TNX"],
  },
};

// Types for the market data structure
export interface MarketData {
  stocks: {
    us: CategoryData;
    europe: CategoryData;
    asia: CategoryData;
  };
  forex: CategoryData;
  bonds: CategoryData;
}

interface CategoryData {
  name: string;
  data: BaseAsset[];
}

export async function getMarketData(): Promise<MarketData> {
  try {
    // Get all unique symbols
    const symbols = Object.values(MARKET_STRUCTURE.stocks.us.assets)
      .concat(MARKET_STRUCTURE.stocks.europe.assets)
      .concat(MARKET_STRUCTURE.stocks.asia.assets)
      .concat(MARKET_STRUCTURE.forex.assets)
      .concat(MARKET_STRUCTURE.bonds.assets);

    // Make a single batch request to Yahoo Finance
    const quotes = await Promise.all(symbols.map(symbol => getQuote(symbol)));

    // Create a map of symbol to quote data for easy lookup
    const quoteMap = symbols.reduce((acc, symbol, index) => {
      acc[symbol] = quotes[index];
      return acc;
    }, {} as Record<string, BaseAsset>);

    // Helper function to get asset data with the correct name
    const getAssetData = (symbol: string): BaseAsset => {
      const data = quoteMap[symbol];
      if (data) {
        data.name = NAME_MAP[symbol as keyof typeof NAME_MAP];
      }
      return data;
    };

    // Helper function to process a category
    const processCategory = (category: MarketCategory): CategoryData => ({
      name: category.name,
      data: category.assets.map(getAssetData),
    });

    // Construct the final market data object
    return {
      stocks: {
        us: processCategory(MARKET_STRUCTURE.stocks.us),
        europe: processCategory(MARKET_STRUCTURE.stocks.europe),
        asia: processCategory(MARKET_STRUCTURE.stocks.asia),
      },
      forex: processCategory(MARKET_STRUCTURE.forex),
      bonds: processCategory(MARKET_STRUCTURE.bonds),
    };
  } catch (error) {
    console.error("Error fetching market data:", error);
    throw error;
  }
}
