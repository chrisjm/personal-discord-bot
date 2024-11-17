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

async function formatMarketEmbed(
  usMarkets: any,
  cryptoMarkets: any,
  worldMarkets: any,
  historyDays: number,
  usHistoryData: HistoricalDataResult[],
  cryptoHistoryData: HistoricalDataResult[]
): Promise<EmbedBuilder> {
  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle('Global Markets Summary')
    .setTimestamp();

  // US Markets Section
  let usMarketsValue = `Status: ${usMarkets.status}\nS&P 500 ETF: $${usMarkets.spyPrice.toFixed(2)} (${usMarkets.spyChange.toFixed(2)}%)\n10Y Treasury: ${usMarkets.tenYearYield.toFixed(2)}%`;

  if (historyDays > 0 && usHistoryData.length > 0) {
    const oldestData = usHistoryData[usHistoryData.length - 1];
    const spyChange = ((usMarkets.spyPrice - oldestData.spy_close) / oldestData.spy_close) * 100;
    const yieldChange = usMarkets.tenYearYield - oldestData.ten_year_yield_close;
    usMarketsValue += `\n${historyDays}d Change: ${spyChange.toFixed(2)}% | Yield: ${yieldChange > 0 ? '+' : ''}${yieldChange.toFixed(2)}%`;
  }

  // Crypto Markets Section
  let cryptoMarketsValue = `Status: ${cryptoMarkets.status}\nBTC: $${cryptoMarkets.btcPrice.toLocaleString()} (${cryptoMarkets.btcChange24h.toFixed(2)}%)\nETH: $${cryptoMarkets.ethPrice.toLocaleString()} (${cryptoMarkets.ethChange24h.toFixed(2)}%)`;

  if (historyDays > 0 && cryptoHistoryData.length > 0) {
    const oldestData = cryptoHistoryData[cryptoHistoryData.length - 1];
    const btcChange = ((cryptoMarkets.btcPrice - oldestData.btc_price) / oldestData.btc_price) * 100;
    const ethChange = ((cryptoMarkets.ethPrice - oldestData.eth_price) / oldestData.eth_price) * 100;
    cryptoMarketsValue += `\n${historyDays}d Changes: BTC: ${btcChange.toFixed(2)}% | ETH: ${ethChange.toFixed(2)}%`;
  }

  embed.addFields([
    {
      name: '🇺🇸 US Markets',
      value: usMarketsValue,
      inline: false
    },
    {
      name: '💰 Crypto Markets',
      value: cryptoMarketsValue,
      inline: false
    },
    {
      name: '🌍 World Markets',
      value: worldMarkets.status,
      inline: false
    }
  ]);

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
  let isDeferred = false;
  try {
    const historyDays = interaction.options.getInteger('history') || 0;
    
    // Start fetching data before deferring
    const marketDataPromise = Promise.all([
      getUSMarketData(),
      getCryptoMarketData(),
      getWorldMarketData()
    ]);

    const historyPromise = historyDays > 0 ? Promise.all([
      usMarketHistoryDb.getLatestMarketHistory(historyDays),
      cryptoMarketHistoryDb.getLatestMarketHistory(historyDays)
    ]) : Promise.resolve([[], []]);

    // Set a timeout to defer the reply if data fetching takes too long
    const deferTimeout = setTimeout(async () => {
      if (!isDeferred) {
        try {
          await interaction.deferReply();
          isDeferred = true;
        } catch (error) {
          console.error('Error deferring reply:', error);
        }
      }
    }, 1500); // Wait 1.5 seconds before deferring

    // Fetch all data
    const [[usMarkets, cryptoMarkets, worldMarkets], [usHistoryData, cryptoHistoryData]] = 
      await Promise.all([marketDataPromise, historyPromise]);

    clearTimeout(deferTimeout);

    const embed = await formatMarketEmbed(
      usMarkets,
      cryptoMarkets,
      worldMarkets,
      historyDays,
      usHistoryData,
      cryptoHistoryData
    );

    // If we haven't deferred yet, just reply immediately
    if (!isDeferred) {
      await interaction.reply({ embeds: [embed] });
    } else {
      await interaction.editReply({ embeds: [embed] });
    }

    // Load historical data in the background if needed
    loadHistoricalDataIfNeeded(historyDays);
  } catch (error) {
    console.error('Error in markets command:', error);
    const errorMessage = 'There was an error fetching market data. Please try again later.';
    
    try {
      if (!isDeferred) {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.editReply(errorMessage);
      }
    } catch (replyError) {
      console.error('Error sending error message:', replyError);
    }
  }
}
