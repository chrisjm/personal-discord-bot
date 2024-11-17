import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import CoinGecko from 'coingecko-api';
import yahooFinance from 'yahoo-finance2';
import { cacheDb } from "../utils/database";

const coinGeckoClient = new CoinGecko();

// Market hours in EST
const marketHours = {
  preMarket: { start: 4, end: 9.5 }, // 4:00 AM - 9:30 AM
  regular: { start: 9.5, end: 16 },  // 9:30 AM - 4:00 PM
  afterHours: { start: 16, end: 20 }, // 4:00 PM - 8:00 PM
};

// Cache for market status and quotes
interface MarketStatusCache {
  status: string;
  spy_price: number;
  ten_year_yield: number;
  timestamp: number;
  valid_until: number;
}

const CACHE_DURATION = 60 * 1000; // 1 minute cache

interface MarketState {
  marketState: 'PRE' | 'REGULAR' | 'POST' | 'CLOSED';
  regularMarketPrice: number;
  regularMarketPreviousClose: number;
}

interface MarketStatusResponse {
  status: string;
  spyPrice: number;
  tenYearYield: number;
}

export const data = new SlashCommandBuilder()
  .setName("market")
  .setDescription("Get cryptocurrency and US market status");

async function getUSMarketStatus(): Promise<MarketStatusResponse> {
  const now = Date.now();
  const est = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = est.getDay();
  const hour = est.getHours() + est.getMinutes() / 60;
  const cache = await cacheDb.getMarketStatusCache();
  const timeBasedStatus = getTimeBasedStatus(hour);

  // Weekend check
  if (day === 0 || day === 6) {
    if (cache && now < cache.valid_until) {
      return {
        status: cache.status,
        spyPrice: cache.spy_price,
        tenYearYield: cache.ten_year_yield
      };
    }

    // Fetch previous close on weekends if no cache
    try {
      const [spyQuote, tnxQuote] = await Promise.all([
        yahooFinance.quote('SPY', { fields: ['regularMarketPreviousClose'] }),
        yahooFinance.quote('^TNX', { fields: ['regularMarketPreviousClose'] })
      ]) as [MarketState, MarketState];

      const newCache = {
        status: "US Markets are closed (Weekend)",
        spy_price: spyQuote.regularMarketPreviousClose,
        ten_year_yield: tnxQuote.regularMarketPreviousClose,
        timestamp: now,
        valid_until: now + CACHE_DURATION * 12 // Cache for longer on weekends
      };
      await cacheDb.updateMarketStatusCache(newCache);
      return {
        status: newCache.status,
        spyPrice: newCache.spy_price,
        tenYearYield: newCache.ten_year_yield
      };
    } catch (error) {
      console.error('Error fetching weekend market data:', error);
      const cache = await cacheDb.getMarketStatusCache();
      return {
        status: "US Markets are closed (Weekend)",
        spyPrice: cache?.spy_price ?? 0,
        tenYearYield: cache?.ten_year_yield ?? 0
      };
    }
  }

  if (cache && now < cache.valid_until) {
    return {
      status: cache.status,
      spyPrice: cache.spy_price,
      tenYearYield: cache.ten_year_yield
    };
  }

  // Only fetch live data during potential trading hours
  if (hour >= marketHours.preMarket.start && hour < marketHours.afterHours.end) {
    try {
      const [spyQuote, tnxQuote] = await Promise.all([
        yahooFinance.quote('SPY', { fields: ['marketState', 'regularMarketPrice', 'regularMarketPreviousClose'] }),
        yahooFinance.quote('^TNX', { fields: ['regularMarketPrice', 'regularMarketPreviousClose'] })
      ]) as [MarketState, MarketState];

      let status: string;
      let spyPrice = spyQuote.regularMarketPrice;
      let tenYearYieldPrice = tnxQuote.regularMarketPrice;

      switch (spyQuote.marketState) {
        case 'PRE':
          status = "Pre-market trading session";
          break;
        case 'REGULAR':
          status = "Regular trading session";
          break;
        case 'POST':
          status = "After-hours trading session";
          break;
        case 'CLOSED':
          status = "US Markets are closed";
          spyPrice = spyQuote.regularMarketPreviousClose;
          tenYearYieldPrice = tnxQuote.regularMarketPreviousClose;
          break;
        default:
          throw new Error('Unknown market state');
      }

      // Update cache
      const newCache = {
        status,
        spy_price: spyPrice,
        ten_year_yield: tenYearYieldPrice,
        timestamp: now,
        valid_until: now + CACHE_DURATION
      };
      await cacheDb.updateMarketStatusCache(newCache);

      return {
        status,
        spyPrice,
        tenYearYield: tnxQuote.regularMarketPrice
      };
    } catch (error) {
      console.error('Error fetching market status:', error);
      const timeBasedStatus = getTimeBasedStatus(hour);
      const cache = await cacheDb.getMarketStatusCache();

      // Cache the error state briefly
      const errorCache = {
        status: timeBasedStatus,
        spy_price: cache?.spy_price ?? 0,
        ten_year_yield: cache?.ten_year_yield ?? 0,
        timestamp: now,
        valid_until: now + (CACHE_DURATION / 2) // Cache errors for less time
      };
      await cacheDb.updateMarketStatusCache(errorCache);

      return {
        status: timeBasedStatus,
        spyPrice: errorCache.spy_price,
        tenYearYield: errorCache.ten_year_yield
      };
    }
  }

  // If outside trading hours and no cache, fetch previous close
  if (!cache) {
    try {
      const [spyQuote, tnxQuote] = await Promise.all([
        yahooFinance.quote('SPY', { fields: ['regularMarketPreviousClose'] }),
        yahooFinance.quote('^TNX', { fields: ['regularMarketPreviousClose'] })
      ]) as [MarketState, MarketState];

      const newCache = {
        status: timeBasedStatus,
        spy_price: spyQuote.regularMarketPreviousClose,
        ten_year_yield: tnxQuote.regularMarketPreviousClose,
        timestamp: now,
        valid_until: now + CACHE_DURATION * 4 // Cache for longer outside trading hours
      };
      await cacheDb.updateMarketStatusCache(newCache);
      return {
        status: newCache.status,
        spyPrice: newCache.spy_price,
        tenYearYield: newCache.ten_year_yield
      };
    } catch (error) {
      console.error('Error fetching after-hours market data:', error);
    }
  }

  return {
    status: timeBasedStatus,
    spyPrice: cache?.spy_price ?? 0,
    tenYearYield: cache?.ten_year_yield ?? 0
  };
}

// Separate function for time-based status to reduce code duplication
function getTimeBasedStatus(hour: number): string {
  if (hour >= marketHours.preMarket.start && hour < marketHours.preMarket.end) {
    return "Pre-market trading session";
  } else if (hour >= marketHours.regular.start && hour < marketHours.regular.end) {
    return "Regular trading session";
  } else if (hour >= marketHours.afterHours.start && hour < marketHours.afterHours.end) {
    return "After-hours trading session";
  }
  return "US Markets are closed";
}

async function getCryptoMarketInfo() {
  try {
    const global = await coinGeckoClient.global();
    const btc = await coinGeckoClient.simple.price({
      ids: ['bitcoin', 'ethereum'],
      vs_currencies: ['usd'],
      include_24hr_change: true,
    });

    return {
      marketCap: global.data.data.total_market_cap.usd,
      btcPrice: btc.data.bitcoin.usd,
      ethPrice: btc.data.ethereum.usd,
      btcChange: btc.data.bitcoin.usd_24h_change,
      ethChange: btc.data.ethereum.usd_24h_change,
    };
  } catch (error) {
    console.error('Error fetching crypto data:', error);
    throw error;
  }
}

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const [marketStatus, cryptoInfo] = await Promise.all([
      getUSMarketStatus(),
      getCryptoMarketInfo()
    ]);

    const formatPrice = (price: number) => price.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    const formatChange = (change: number) => {
      const sign = change >= 0 ? '▲' : '▼';
      const arrows = change >= 0 ? '🟢' : '🔴';
      return `${arrows} ${sign} ${Math.abs(change).toFixed(2)}%`;
    };

    const formatMarketCap = (cap: number) => {
      return (cap / 1e12).toFixed(2) + ' Trillion USD';
    };

    const formatYield = (yield_: number) => {
      return `${yield_.toFixed(3)}%`;
    };

    const getEmbedColor = (btcChange: number) => {
      if (btcChange >= 2) return 0x00FF00; // Strong green for >2% gain
      if (btcChange > 0) return 0x90EE90;  // Light green for 0-2% gain
      if (btcChange > -2) return 0xFFCCCB; // Light red for 0-2% loss
      return 0xFF0000;                     // Strong red for >2% loss
    };

    const embed = new EmbedBuilder()
      .setColor(getEmbedColor(cryptoInfo.btcChange))
      .setTitle('📊 Market Status')
      .addFields(
        { name: '🏛️ US Stock Market', value: marketStatus.status, inline: false },
        {
          name: '📈 S&P 500 ETF (SPY)',
          value: formatPrice(marketStatus.spyPrice),
          inline: true
        },
        {
          name: '📊 10-Year Treasury Yield',
          value: formatYield(marketStatus.tenYearYield),
          inline: true
        },
        { name: '\u200B', value: '\u200B', inline: true }, // Empty field for alignment
        { name: '🌐 Crypto Market Cap', value: formatMarketCap(cryptoInfo.marketCap), inline: false },
        {
          name: '₿ Bitcoin (BTC)',
          value: `${formatPrice(cryptoInfo.btcPrice)}\n${formatChange(cryptoInfo.btcChange)}`,
          inline: true
        },
        {
          name: 'Ξ Ethereum (ETH)',
          value: `${formatPrice(cryptoInfo.ethPrice)}\n${formatChange(cryptoInfo.ethChange)}`,
          inline: true
        }
      )
      .setTimestamp()
      .setFooter({ text: 'Data from Yahoo Finance & CoinGecko' });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in market command:', error);
    await interaction.editReply('Error fetching market data. Please try again later.');
  }
}
