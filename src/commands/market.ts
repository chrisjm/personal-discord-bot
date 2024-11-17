import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import CoinGecko from 'coingecko-api';
import yahooFinance from 'yahoo-finance2';
import { cacheDb, marketHistoryDb } from "../utils/database";
import { MarketHistoryEntry } from "../utils/MarketHistoryDatabase";

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
  regularMarketOpen?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
}

interface MarketStatusResponse {
  status: string;
  spyPrice: number;
  tenYearYield: number;
  historyData?: MarketHistoryEntry[];
}

export const data = new SlashCommandBuilder()
  .setName("market")
  .setDescription("Get cryptocurrency and US market status")
  .addIntegerOption(option =>
    option.setName('history')
      .setDescription('Number of days of historical data to show (max 30)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(30));

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
        yahooFinance.quote('SPY', {
          fields: [
            'marketState',
            'regularMarketPrice',
            'regularMarketPreviousClose',
            'regularMarketOpen',
            'regularMarketDayHigh',
            'regularMarketDayLow',
            'regularMarketVolume'
          ]
        }),
        yahooFinance.quote('^TNX', {
          fields: [
            'regularMarketPrice',
            'regularMarketPreviousClose',
            'regularMarketOpen'
          ]
        })
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

      // Get crypto info and update historical data
      const cryptoInfo = await getCryptoMarketInfo();
      await updateHistoricalData(spyQuote, tnxQuote, cryptoInfo, est);

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

async function updateHistoricalData(
  spyQuote: MarketState,
  tnxQuote: MarketState,
  cryptoInfo: Awaited<ReturnType<typeof getCryptoMarketInfo>>,
  est: Date
) {
  const now = Date.now();
  const today = est.toISOString().split('T')[0];

  // Always update crypto data since it's 24/7
  const baseHistoryEntry = {
    date: today,
    btc_price: cryptoInfo.btcPrice,
    btc_volume: cryptoInfo.btcVolume,
    btc_market_cap: cryptoInfo.btcMarketCap,
    eth_price: cryptoInfo.ethPrice,
    eth_volume: cryptoInfo.ethVolume,
    eth_market_cap: cryptoInfo.ethMarketCap,
    timestamp: now,
  };

  // Only include US market data if markets are closed and we have all required data
  if (spyQuote.marketState === 'CLOSED' &&
      spyQuote.regularMarketOpen !== undefined &&
      spyQuote.regularMarketDayHigh !== undefined &&
      spyQuote.regularMarketDayLow !== undefined &&
      spyQuote.regularMarketVolume !== undefined &&
      tnxQuote.regularMarketOpen !== undefined) {

    await marketHistoryDb.addMarketHistory({
      ...baseHistoryEntry,
      spy_open: spyQuote.regularMarketOpen,
      spy_close: spyQuote.regularMarketPreviousClose,
      spy_high: spyQuote.regularMarketDayHigh,
      spy_low: spyQuote.regularMarketDayLow,
      ten_year_yield_open: tnxQuote.regularMarketOpen,
      ten_year_yield_close: tnxQuote.regularMarketPreviousClose,
      volume: spyQuote.regularMarketVolume,
    });
  } else {
    // If markets aren't closed yet, just store crypto data with placeholder values for market data
    await marketHistoryDb.addMarketHistory({
      ...baseHistoryEntry,
      spy_open: 0,
      spy_close: 0,
      spy_high: 0,
      spy_low: 0,
      ten_year_yield_open: 0,
      ten_year_yield_close: 0,
      volume: 0,
    });
  }
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

async function loadHistoricalData() {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    // Format dates for Yahoo Finance
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];

    // Get existing dates in our database
    const existingData = await marketHistoryDb.getLatestMarketHistory(30);
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

    // Fetch crypto historical data
    const [cryptoData, ethData] = await Promise.all([
      coinGeckoClient.coins.fetchMarketChartRange('bitcoin', {
        from: thirtyDaysAgo.getTime() / 1000,
        to: now.getTime() / 1000,
        vs_currency: 'usd'
      }),
      coinGeckoClient.coins.fetchMarketChartRange('ethereum', {
        from: thirtyDaysAgo.getTime() / 1000,
        to: now.getTime() / 1000,
        vs_currency: 'usd'
      })
    ]);

    // Create maps for crypto data
    const btcDataMap = new Map();
    const ethDataMap = new Map();

    // Validate crypto data responses
    if (!cryptoData?.data?.prices || !cryptoData?.data?.total_volumes || !cryptoData?.data?.market_caps ||
        !ethData?.data?.prices || !ethData?.data?.total_volumes || !ethData?.data?.market_caps) {
      console.error('Invalid or missing crypto data from CoinGecko');
      return;
    }

    // Process BTC data
    const btcPrices = cryptoData.data.prices;
    const btcVolumes = cryptoData.data.total_volumes;
    const btcMarketCaps = cryptoData.data.market_caps;

    for (let i = 0; i < btcPrices.length; i++) {
      const [timestamp, price] = btcPrices[i];
      const volume = btcVolumes[i]?.[1] || 0;
      const marketCap = btcMarketCaps[i]?.[1] || 0;
      const date = new Date(timestamp).toISOString().split('T')[0];

      btcDataMap.set(date, {
        price,
        volume,
        marketCap
      });
    }

    // Process ETH data
    const ethPrices = ethData.data.prices;
    const ethVolumes = ethData.data.total_volumes;
    const ethMarketCaps = ethData.data.market_caps;

    for (let i = 0; i < ethPrices.length; i++) {
      const [timestamp, price] = ethPrices[i];
      const volume = ethVolumes[i]?.[1] || 0;
      const marketCap = ethMarketCaps[i]?.[1] || 0;
      const date = new Date(timestamp).toISOString().split('T')[0];

      ethDataMap.set(date, {
        price,
        volume,
        marketCap
      });
    }

    // Process and store each day's data
    for (const spyDay of spyHistory) {
      const date = spyDay.date.toISOString().split('T')[0];

      // Skip if we already have this date
      if (existingDates.has(date)) {
        continue;
      }

      const tnxDay = tnxDataMap.get(date);
      const btcDay = btcDataMap.get(date);
      const ethDay = ethDataMap.get(date);

      if (!tnxDay) {
        continue; // Skip if we don't have TNX data for this day
      }

      await marketHistoryDb.addMarketHistory({
        date,
        spy_open: spyDay.open,
        spy_close: spyDay.close,
        spy_high: spyDay.high,
        spy_low: spyDay.low,
        ten_year_yield_open: tnxDay.open,
        ten_year_yield_close: tnxDay.close,
        volume: spyDay.volume,
        btc_price: btcDay?.price || 0,
        btc_volume: btcDay?.volume || 0,
        btc_market_cap: btcDay?.marketCap || 0,
        eth_price: ethDay?.price || 0,
        eth_volume: ethDay?.volume || 0,
        eth_market_cap: ethDay?.marketCap || 0,
        timestamp: spyDay.date.getTime()
      });
    }

    console.log('Historical data load completed');
  } catch (error) {
    console.error('Error loading historical data:', error);
  }
}

async function getCryptoMarketInfo() {
  try {
    const [global, prices] = await Promise.all([
      coinGeckoClient.global(),
      coinGeckoClient.simple.price({
        ids: ['bitcoin', 'ethereum'],
        vs_currencies: ['usd'],
        include_24hr_vol: true,
        include_24hr_change: true,
        include_market_cap: true,
      })
    ]);

    // Validate API responses
    if (!global?.data?.data?.total_market_cap?.usd) {
      throw new Error('Invalid global market data from CoinGecko');
    }

    if (!prices?.data?.bitcoin?.usd || !prices?.data?.ethereum?.usd) {
      throw new Error('Invalid price data from CoinGecko');
    }

    const btcData = prices.data.bitcoin;
    const ethData = prices.data.ethereum;

    return {
      marketCap: global.data.data.total_market_cap.usd,
      btcPrice: btcData.usd,
      ethPrice: ethData.usd,
      btcChange: btcData.usd_24h_change || 0,
      ethChange: ethData.usd_24h_change || 0,
      btcVolume: btcData.usd_24h_vol || 0,
      ethVolume: ethData.usd_24h_vol || 0,
      btcMarketCap: btcData.usd_market_cap || 0,
      ethMarketCap: ethData.usd_market_cap || 0,
    };
  } catch (error) {
    console.error('Error fetching crypto data:', error);
    // Return default values instead of throwing
    return {
      marketCap: 0,
      btcPrice: 0,
      ethPrice: 0,
      btcChange: 0,
      ethChange: 0,
      btcVolume: 0,
      ethVolume: 0,
      btcMarketCap: 0,
      ethMarketCap: 0,
    };
  }
}

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    // Load historical data if needed (in background)
    const historyData = await marketHistoryDb.getLatestMarketHistory(30);
    if (historyData.length < 30) {
      loadHistoricalData().catch(console.error);
    }

    const [marketStatus, cryptoInfo] = await Promise.all([
      getUSMarketStatus(),
      getCryptoMarketInfo()
    ]);

    const historyDays = interaction.options.getInteger('history') || 0;
    let displayHistoryData: MarketHistoryEntry[] = [];

    if (historyDays > 0) {
      displayHistoryData = await marketHistoryDb.getLatestMarketHistory(historyDays);
    }

    // Utility functions for formatting
    function formatPrice(price: number): string {
      return price.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }

    function formatChange(change: number): string {
      const sign = change >= 0 ? '▲' : '▼';
      const arrows = change >= 0 ? '🟢' : '🔴';
      return `${arrows} ${sign} ${Math.abs(change).toFixed(2)}%`;
    }

    function getEmbedColor(change: number): number {
      if (change >= 2) return 0x00FF00; // Strong green for >2% gain
      if (change > 0) return 0x90EE90;  // Light green for 0-2% gain
      if (change > -2) return 0xFFCCCB; // Light red for 0-2% loss
      return 0xFF0000;                  // Strong red for >2% loss
    }

    function formatMarketCap(cap: number): string {
      return (cap / 1e12).toFixed(2) + ' Trillion USD';
    }

    // Calculate SPY daily change if we have history data
    const spyDailyChange = displayHistoryData.length > 0
      ? ((marketStatus.spyPrice - displayHistoryData[0].spy_close) / displayHistoryData[0].spy_close) * 100
      : 0;

    const embed = new EmbedBuilder()
      .setColor(getEmbedColor(spyDailyChange))
      .setTitle('Market Status')
      .setTimestamp()
      .setFooter({ text: 'Data from Yahoo Finance & CoinGecko' });

    // US Markets Section
    embed.addFields(
      {
        name: '🏛️ US Markets',
        value: marketStatus.status,
        inline: false
      },
      {
        name: '📈 S&P 500 ETF (SPY)',
        value: `$${formatPrice(marketStatus.spyPrice)} ${spyDailyChange !== 0 ? formatChange(spyDailyChange) : ''}`,
        inline: true
      },
      {
        name: '📊 10Y Treasury Yield',
        value: `${marketStatus.tenYearYield.toFixed(2)}%`,
        inline: true
      },
      { name: '\u200B', value: '\u200B', inline: true } // Empty field for alignment
    );

    // Crypto Section
    embed.addFields(
      {
        name: '🌐 Cryptocurrency Markets',
        value: `Market Cap: ${formatMarketCap(cryptoInfo.marketCap)}`,
        inline: false
      },
      {
        name: '₿ Bitcoin (BTC)',
        value: `$${formatPrice(cryptoInfo.btcPrice)}\n${formatChange(cryptoInfo.btcChange)}`,
        inline: true
      },
      {
        name: 'Ξ Ethereum (ETH)',
        value: `$${formatPrice(cryptoInfo.ethPrice)}\n${formatChange(cryptoInfo.ethChange)}`,
        inline: true
      },
      { name: '\u200B', value: '\u200B', inline: true } // Empty field for alignment
    );

    // Historical Data Section
    if (displayHistoryData.length > 0) {
      const oldestData = displayHistoryData[displayHistoryData.length - 1];
      const newestData = displayHistoryData[0];

      // Calculate changes
      const spyChange = ((marketStatus.spyPrice - oldestData.spy_close) / oldestData.spy_close) * 100;
      const yieldChange = marketStatus.tenYearYield - oldestData.ten_year_yield_close;
      const btcChange = ((cryptoInfo.btcPrice - oldestData.btc_price) / oldestData.btc_price) * 100;
      const ethChange = ((cryptoInfo.ethPrice - oldestData.eth_price) / oldestData.eth_price) * 100;

      // Find highest and lowest points
      const spyHighest = Math.max(...displayHistoryData.map(d => d.spy_high));
      const spyLowest = Math.min(...displayHistoryData.map(d => d.spy_low));
      const yieldHighest = Math.max(...displayHistoryData.map(d => d.ten_year_yield_close));
      const yieldLowest = Math.min(...displayHistoryData.map(d => d.ten_year_yield_close));
      const btcHighest = Math.max(...displayHistoryData.map(d => d.btc_price));
      const btcLowest = Math.min(...displayHistoryData.map(d => d.btc_price));
      const ethHighest = Math.max(...displayHistoryData.map(d => d.eth_price));
      const ethLowest = Math.min(...displayHistoryData.map(d => d.eth_price));

      const marketHistoryText = `**${displayHistoryData.length}-Day US Market Summary** (since ${oldestData.date})
SPY: $${formatPrice(oldestData.spy_close || 0)} → $${formatPrice(marketStatus.spyPrice)} ${formatChange(spyChange)}
• Range: $${formatPrice(spyLowest)} - $${formatPrice(spyHighest)}
10Y: ${(oldestData.ten_year_yield_close || 0).toFixed(2)}% → ${marketStatus.tenYearYield.toFixed(2)}% (${yieldChange >= 0 ? '+' : ''}${yieldChange.toFixed(2)})
• Range: ${yieldLowest.toFixed(2)}% - ${yieldHighest.toFixed(2)}%`;

      const cryptoHistoryText = `**${displayHistoryData.length}-Day Crypto Summary** (since ${oldestData.date})
BTC: $${formatPrice(oldestData.btc_price || 0)} → $${formatPrice(cryptoInfo.btcPrice)} ${formatChange(btcChange)}
• Range: $${formatPrice(btcLowest)} - $${formatPrice(btcHighest)}
ETH: $${formatPrice(oldestData.eth_price || 0)} → $${formatPrice(cryptoInfo.ethPrice)} ${formatChange(ethChange)}
• Range: $${formatPrice(ethLowest)} - $${formatPrice(ethHighest)}`;

      embed.addFields(
        {
          name: '📅 Historical Market Performance',
          value: marketHistoryText,
          inline: false
        },
        {
          name: '📅 Historical Crypto Performance',
          value: cryptoHistoryText,
          inline: false
        }
      );
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in market command:', error);
    await interaction.editReply('Error fetching market data. Please try again later.');
  }
}
