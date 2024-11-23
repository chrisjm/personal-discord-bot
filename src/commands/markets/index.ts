import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getMarketData as getStockMarketData } from "./assets/stocks";
import { getMarketData as getCryptoMarketData } from "./assets/crypto";

export const data = new SlashCommandBuilder()
  .setName("markets")
  .setDescription("Get a summary of global markets including US, Crypto, and World markets")

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
  const roundedChange = Math.round(change * 100) / 100;

  const greenShades = [
    0xccffcc, // Very light green
    0x99ff99, // Light green
    0x66cc66, // Medium light green
    0x339933, // Medium green
    0x006600  // Dark green
  ];

  const redShades = [
    0xffcccc, // Very light red
    0xff9999, // Light red
    0xff6666, // Medium light red
    0xff3333, // Medium red
    0xcc0000  // Dark red
  ];

  if (roundedChange === 0) {
    return 0xffffff; // White
  }

  if (roundedChange > 0) {
    // Changes 0-10% mapped to 5 green shades
    const index = Math.min(Math.floor(roundedChange / 2), 4);
    return greenShades[index];
  }

  // Changes 0-10% mapped to 5 red shades
  const index = Math.min(Math.floor(Math.abs(roundedChange) / 2), 4);
  return redShades[index];
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

function getAverageChangeColor(changes: number[]): number {
  const sum = changes.reduce((acc, cur) => acc + cur, 0);
  const average = sum / changes.length;
  console.log(changes, average);
  return getChangeColor(average);
}

async function formatMarketEmbed(): Promise<EmbedBuilder> {
  const [stockData, cryptoData] = await Promise.all([
    getStockMarketData(),
    getCryptoMarketData(),
  ]);

  const changes = [
    stockData.us.sp500.percentChange,
    stockData.us.dow.percentChange,
    stockData.us.nasdaq.percentChange,
    stockData.europe.dax.percentChange,
    stockData.europe.ftse100.percentChange,
    stockData.europe.cac40.percentChange,
    stockData.asia.nikkei.percentChange,
    stockData.asia.hang_seng.percentChange,
    stockData.asia.shanghai.percentChange,
  ];

  const embed = new EmbedBuilder()
    .setTitle("🌎 Global Market Summary")
    .setColor(getAverageChangeColor(changes))
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
    const embed = await formatMarketEmbed();
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error fetching market data:', error);
    await interaction.editReply('Failed to fetch market data. Please try again later.');
  }
}
