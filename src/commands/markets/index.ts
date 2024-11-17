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

function getChangeEmoji(change: number): string {
  if (change > 1.5) return '🚀';
  if (change > 0) return '📈';
  if (change < -1.5) return '📉';
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
  const spyChange = usMarkets.spyChange;
  const spyEmoji = getChangeEmoji(spyChange);
  leftColumn += '🏛️ __**US Markets**__\n';
  leftColumn += `**Status:** ${usMarkets.status}\n`;
  leftColumn += `${spyEmoji} **S&P 500:** $${formatPrice(usMarkets.spyPrice)} (${formatChange(spyChange)})\n`;
  leftColumn += `📊 **10Y Treasury:** ${usMarkets.tenYearYield.toFixed(2)}%\n`;

  if (historyDays > 0 && usHistoryData.length > 0) {
    const oldestData = usHistoryData[usHistoryData.length - 1];
    const spyChange = ((usMarkets.spyPrice - oldestData.spy_close) / oldestData.spy_close) * 100;
    const yieldChange = usMarkets.tenYearYield - oldestData.ten_year_yield_close;
    leftColumn += `📅 **${historyDays}d Change:**\n`;
    leftColumn += `SPY: ${formatChange(spyChange)} | Yield: ${yieldChange > 0 ? '+' : ''}${yieldChange.toFixed(2)}%\n`;
  }

  // Crypto Markets Section
  leftColumn += '\n🔗 __**Crypto Markets**__\n';
  leftColumn += `**Status:** ${cryptoMarkets.status}\n`;
  const btcEmoji = getChangeEmoji(cryptoMarkets.btcChange24h);
  const ethEmoji = getChangeEmoji(cryptoMarkets.ethChange24h);
  leftColumn += `${btcEmoji} **BTC:** $${formatPrice(cryptoMarkets.btcPrice)} (${formatChange(cryptoMarkets.btcChange24h)})\n`;
  leftColumn += `${ethEmoji} **ETH:** $${formatPrice(cryptoMarkets.ethPrice)} (${formatChange(cryptoMarkets.ethChange24h)})`;

  // Right Column: World Markets
  let rightColumn = '🌐 __**World Markets**__\n';
  rightColumn += `**Status:** ${worldMarkets.status}\n\n`;
  
  // European Markets
  const { dax, ftse100, cac40 } = worldMarkets.markets.europe;
  rightColumn += "🇪🇺 __European Indices:__\n";
  rightColumn += [
    `${getChangeEmoji(dax.percentChange)} **DAX:** ${formatPrice(dax.price)} (${formatChange(dax.percentChange)})`,
    `${getChangeEmoji(ftse100.percentChange)} **FTSE:** ${formatPrice(ftse100.price)} (${formatChange(ftse100.percentChange)})`,
    `${getChangeEmoji(cac40.percentChange)} **CAC40:** ${formatPrice(cac40.price)} (${formatChange(cac40.percentChange)})`
  ].join('\n');

  // Asian Markets
  const { nikkei, hang_seng, shanghai } = worldMarkets.markets.asia;
  rightColumn += "\n\n🌏 __Asian Indices:__\n";
  rightColumn += [
    `${getChangeEmoji(nikkei.percentChange)} **Nikkei:** ${formatPrice(nikkei.price)} (${formatChange(nikkei.percentChange)})`,
    `${getChangeEmoji(hang_seng.percentChange)} **HSI:** ${formatPrice(hang_seng.price)} (${formatChange(hang_seng.percentChange)})`,
    `${getChangeEmoji(shanghai.percentChange)} **SSEC:** ${formatPrice(shanghai.price)} (${formatChange(shanghai.percentChange)})`
  ].join('\n');

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
