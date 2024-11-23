import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { StockMarkets } from "./assets/stocks";
import { CryptoMarkets } from "./assets/crypto";

export const data = new SlashCommandBuilder()
  .setName("markets")
  .setDescription("Get a summary of global markets including US, Crypto, and World markets")

const stockMarkets = new StockMarkets();
const cryptoMarkets = new CryptoMarkets();

function getChangeEmoji(change: number): string {
  if (change > 0) return "🟢";
  if (change < 0) return "🔴";
  return "⚪";
}

function formatPrice(price: number): string {
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatChange(change: number): string {
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}%`;
}

function getChangeColor(change: number): number {
  return change >= 0 ? 0x00ff00 : 0xff0000;
}

function formatMarketEntry({ name, price, percentChange, isOpen, extraInfo }: {
  name: string;
  price: number;
  percentChange: number;
  isOpen?: boolean;
  extraInfo?: string;
}): string {
  const emoji = getChangeEmoji(percentChange);
  const formattedPrice = formatPrice(price);
  const formattedChange = formatChange(percentChange);
  const status = isOpen === false ? " (CLOSED)" : "";
  const extra = extraInfo ? ` | ${extraInfo}` : "";

  return `${emoji} **${name}**: $${formattedPrice} (${formattedChange})${status}${extra}`;
}

async function formatMarketEmbed(historyDays: number): Promise<EmbedBuilder> {
  const [stockData, cryptoData] = await Promise.all([
    stockMarkets.getMarketData(),
    cryptoMarkets.getMarketData(),
  ]);

  const embed = new EmbedBuilder()
    .setTitle("🌎 Global Market Summary")
    .setColor(getChangeColor(stockData.us.sp500.percentChange))
    .setTimestamp()
    .addFields(
      {
        name: "🇺🇸 US Markets",
        value: [
          formatMarketEntry({ name: "S&P 500", ...stockData.us.sp500 }),
          formatMarketEntry({ name: "Dow Jones", ...stockData.us.dow }),
          formatMarketEntry({ name: "NASDAQ", ...stockData.us.nasdaq }),
        ].join("\n"),
        inline: false,
      },
      {
        name: "💰 Crypto",
        value: [
          formatMarketEntry({ name: "Bitcoin", ...cryptoData.btc }),
          formatMarketEntry({ name: "Ethereum", ...cryptoData.eth }),
        ].join("\n"),
        inline: false,
      },
      {
        name: "🇪🇺 European Markets",
        value: [
          formatMarketEntry({ name: "DAX", ...stockData.europe.dax }),
          formatMarketEntry({ name: "FTSE 100", ...stockData.europe.ftse100 }),
          formatMarketEntry({ name: "CAC 40", ...stockData.europe.cac40 }),
        ].join("\n"),
        inline: false,
      },
      {
        name: "🌏 Asian Markets",
        value: [
          formatMarketEntry({ name: "Nikkei 225", ...stockData.asia.nikkei }),
          formatMarketEntry({ name: "Hang Seng", ...stockData.asia.hang_seng }),
          formatMarketEntry({ name: "Shanghai", ...stockData.asia.shanghai }),
        ].join("\n"),
        inline: false,
      }
    );

  return embed;
}

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const historyDays = interaction.options.getInteger('history') || 0;
    const embed = await formatMarketEmbed(historyDays);
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in markets command:', error);
    await interaction.editReply('Sorry, there was an error fetching market data. Please try again later.');
  }
}
