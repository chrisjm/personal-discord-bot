import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getUSMarketData, loadUSHistoricalData } from "./usMarkets";
import { getCryptoMarketData, loadCryptoHistoricalData } from "./cryptoMarkets";
import { getWorldMarketData } from "./worldMarkets";
import { usMarketHistoryDb, cryptoMarketHistoryDb } from "../../utils/marketHistory";

// Maximum number of days for historical data
const MAX_HISTORY_DAYS = 30;

export const data = new SlashCommandBuilder()
  .setName("markets")
  .setDescription("Get a summary of global markets including US, Crypto, and World markets")
  .addIntegerOption(option =>
    option.setName('history')
      .setDescription(`Number of days of historical data to show (max ${MAX_HISTORY_DAYS})`)
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(MAX_HISTORY_DAYS));

interface HistoricalDataResult {
  date: string;
  [key: string]: any;
}

interface MarketEntry {
  name: string;
  price: number;
  percentChange: number;
  previousClose?: number;
  isOpen?: boolean;
  extraInfo?: string;
}

function getChangeEmoji(change: number): string {
  if (change > 1.5) return '🚀';
  if (change > 0) return '🟢';
  if (change < -1.5) return '🔴';
  if (change < 0) return '🔻';
  return '➡️';
}

function formatPrice(price: number): string {
  return price >= 1000 ? price.toLocaleString() : price.toFixed(2);
}

function formatChange(change: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}%`;
}

function getChangeColor(change: number): number {
  return change >= 0 ? 0x00ff00 : 0xff0000;  // Green for positive, red for negative
}

function formatMarketEntry(entry: MarketEntry): string {
  const emoji = getChangeEmoji(entry.percentChange);
  const priceInfo = `${formatPrice(entry.price)} (${formatChange(entry.percentChange)})`;
  const status = entry.isOpen !== undefined 
    ? (entry.isOpen ? '🟢 Open' : '🔴 Closed')
    : '';
  const statusText = status ? ` (${status})` : '';
  const prevClose = (entry.previousClose && !entry.isOpen) 
    ? `\nPrev Close: ${formatPrice(entry.previousClose)}` : '';
  const extra = entry.extraInfo 
    ? `\n${entry.extraInfo}` : '';
  return `${emoji} **${entry.name}**${statusText}\n→ ${priceInfo}${prevClose}${extra}`;
}

async function formatMarketEmbed(
  usMarkets: any,
  cryptoMarkets: any,
  worldMarkets: any,
  historyDays: number,
  usHistoryData: HistoricalDataResult[],
  cryptoHistoryData: HistoricalDataResult[]
): Promise<EmbedBuilder> {
  const embed = new EmbedBuilder()
    .setColor(getChangeColor(usMarkets.spyChange))
    .setTitle('🌎 Global Markets Summary')
    .setTimestamp();

  // Left Column: US & Crypto Markets
  let leftColumn = '';

  // US Markets Section
  leftColumn += '🏛️ __**US Markets**__\n';
  leftColumn += [
    formatMarketEntry({
      name: 'S&P 500',
      price: usMarkets.spyPrice,
      percentChange: usMarkets.spyChange,
      previousClose: usMarkets.spyPreviousClose,
      isOpen: usMarkets.status === 'Market Open',
    }),
    formatMarketEntry({
      name: 'NASDAQ',
      price: usMarkets.qqqPrice,
      percentChange: usMarkets.qqqChange,
      previousClose: usMarkets.qqqPreviousClose,
      isOpen: usMarkets.status === 'Market Open',
    }),
    formatMarketEntry({
      name: 'Dow Jones',
      price: usMarkets.diaPrice,
      percentChange: usMarkets.diaChange,
      previousClose: usMarkets.diaPreviousClose,
      isOpen: usMarkets.status === 'Market Open',
    }),
    formatMarketEntry({
      name: '10Y Treasury',
      price: usMarkets.tenYearYield,
      percentChange: usMarkets.tenYearYieldChange,
      previousClose: usMarkets.tenYearYieldPreviousClose,
      isOpen: usMarkets.status === 'Market Open',
      extraInfo: `Yield: ${usMarkets.tenYearYield.toFixed(2)}%`
    })
  ].join('\n\n');

  if (historyDays > 0 && usHistoryData.length > 0) {
    const oldestData = usHistoryData[usHistoryData.length - 1];
    const spyChange = ((usMarkets.spyPrice - oldestData.spy_close) / oldestData.spy_close) * 100;
    const yieldChange = usMarkets.tenYearYield - oldestData.ten_year_yield_close;
    leftColumn += `\n\n📅 __**${historyDays}d Change:**__\n`;
    leftColumn += `→ SPY: ${formatChange(spyChange)}\n→ Yield: ${yieldChange > 0 ? '+' : ''}${yieldChange.toFixed(2)}%`;
  }

  // Crypto Markets Section
  leftColumn += '\n\n🔗 __**Crypto Markets**__\n';
  leftColumn += [
    formatMarketEntry({
      name: 'Bitcoin',
      price: cryptoMarkets.btcPrice,
      percentChange: cryptoMarkets.btcChange24h,
      extraInfo: '24h Change'
    }),
    formatMarketEntry({
      name: 'Ethereum',
      price: cryptoMarkets.ethPrice,
      percentChange: cryptoMarkets.ethChange24h,
      extraInfo: '24h Change'
    })
  ].join('\n\n');

  // Right Column: World Markets
  let rightColumn = '🌐 __**World Markets**__\n';

  // European Markets
  const { dax, ftse100, cac40 } = worldMarkets.markets.europe;
  rightColumn += "🇪🇺 __European Indices:__\n";
  rightColumn += [
    formatMarketEntry({
      name: 'DAX',
      price: dax.price,
      percentChange: dax.percentChange,
      previousClose: dax.previousClose,
      isOpen: dax.isOpen
    }),
    formatMarketEntry({
      name: 'FTSE',
      price: ftse100.price,
      percentChange: ftse100.percentChange,
      previousClose: ftse100.previousClose,
      isOpen: ftse100.isOpen
    }),
    formatMarketEntry({
      name: 'CAC40',
      price: cac40.price,
      percentChange: cac40.percentChange,
      previousClose: cac40.previousClose,
      isOpen: cac40.isOpen
    })
  ].join('\n\n');

  // Asian Markets
  const { nikkei, hang_seng, shanghai } = worldMarkets.markets.asia;
  rightColumn += "\n\n🌏 __Asian Indices:__\n";
  rightColumn += [
    formatMarketEntry({
      name: 'Nikkei',
      price: nikkei.price,
      percentChange: nikkei.percentChange,
      previousClose: nikkei.previousClose,
      isOpen: nikkei.isOpen
    }),
    formatMarketEntry({
      name: 'Hang Seng',
      price: hang_seng.price,
      percentChange: hang_seng.percentChange,
      previousClose: hang_seng.previousClose,
      isOpen: hang_seng.isOpen
    }),
    formatMarketEntry({
      name: 'Shanghai',
      price: shanghai.price,
      percentChange: shanghai.percentChange,
      previousClose: shanghai.previousClose,
      isOpen: shanghai.isOpen
    })
  ].join('\n\n');

  // Add fields to embed
  embed.addFields(
    { name: '\u200B', value: leftColumn, inline: true },
    { name: '\u200B', value: rightColumn, inline: true }
  );

  return embed;
}

async function loadHistoricalDataIfNeeded(historyDays: number): Promise<void> {
  if (historyDays <= 0) return;

  try {
    const [usHistory, cryptoHistory] = await Promise.all([
      usMarketHistoryDb.getLatestMarketHistory(MAX_HISTORY_DAYS),
      cryptoMarketHistoryDb.getLatestMarketHistory(MAX_HISTORY_DAYS)
    ]);

    if (usHistory.length < MAX_HISTORY_DAYS) {
      loadUSHistoricalData().catch(error => {
        console.error('Error loading US historical data:', error);
      });
    }
    if (cryptoHistory.length < MAX_HISTORY_DAYS) {
      loadCryptoHistoricalData().catch(error => {
        console.error('Error loading crypto historical data:', error);
      });
    }
  } catch (error) {
    console.error('Error checking historical data:', error);
  }
}

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    // Defer the reply to handle potentially slow API calls
    await interaction.deferReply();

    // Get history days from interaction option (default to 0 if not provided)
    const historyDays = interaction.options.getInteger('history') || 0;

    // Validate history days
    if (historyDays > MAX_HISTORY_DAYS) {
      await interaction.editReply(`History cannot exceed ${MAX_HISTORY_DAYS} days.`);
      return;
    }

    // Load historical data if needed
    await loadHistoricalDataIfNeeded(historyDays);

    // Fetch market data concurrently
    const [
      usMarkets,
      cryptoMarkets,
      worldMarkets,
      usHistoryData,
      cryptoHistoryData
    ] = await Promise.all([
      getUSMarketData(),
      getCryptoMarketData(),
      getWorldMarketData(),
      historyDays > 0 ? usMarketHistoryDb.getLatestMarketHistory(historyDays) : Promise.resolve([]),
      historyDays > 0 ? cryptoMarketHistoryDb.getLatestMarketHistory(historyDays) : Promise.resolve([])
    ]);

    // Create and send embed
    const embed = await formatMarketEmbed(
      usMarkets,
      cryptoMarkets,
      worldMarkets,
      historyDays,
      usHistoryData,
      cryptoHistoryData
    );

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in markets command:', error);
    await interaction.editReply('Failed to fetch market data. Please try again later.');
  }
}
