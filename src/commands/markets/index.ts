import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import { getMarketData as getTraditionalMarketData } from "./assets/traditional";
import { getMarketData as getCryptoMarketData } from "./assets/crypto";
import { BaseAsset } from "../../types/markets";

export const data = new SlashCommandBuilder()
  .setName("markets")
  .setDescription(
    "Get a summary of global markets including US, Crypto, and World markets",
  );

function getChangeEmoji(change: number): string {
  if (change > 0) return "🟢";
  if (change < 0) return "🔴";
  return "⚪";
}

function isMarketOpen(marketType: "US" | "Europe" | "Asia"): {
  isOpen: boolean;
  emoji: string;
} {
  const now = new Date();
  const hour = now.getUTCHours();
  const day = now.getUTCDay();

  // Weekend check (Saturday = 6, Sunday = 0)
  if (day === 0 || day === 6) {
    return { isOpen: false, emoji: "🔴" };
  }

  switch (marketType) {
    case "US":
      // US Market hours: 9:30 AM - 4:00 PM ET (13:30 - 20:00 UTC)
      return {
        isOpen: hour >= 13 && hour < 20,
        emoji: hour >= 13 && hour < 20 ? "🟢" : "🔴",
      };
    case "Europe":
      // European Market hours: 8:00 AM - 4:30 PM CET (7:00 - 15:30 UTC)
      return {
        isOpen: hour >= 7 && hour < 16,
        emoji: hour >= 7 && hour < 16 ? "🟢" : "🔴",
      };
    case "Asia":
      // Asian Market hours: 9:00 AM - 3:00 PM JST (0:00 - 6:00 UTC)
      return {
        isOpen: hour >= 0 && hour < 6,
        emoji: hour >= 0 && hour < 6 ? "🟢" : "🔴",
      };
  }
}

function formatPrice(price: number): string {
  return price.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
    0x006600, // Dark green
  ];

  const redShades = [
    0xffcccc, // Very light red
    0xff9999, // Light red
    0xff6666, // Medium light red
    0xff3333, // Medium red
    0xcc0000, // Dark red
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

// Currency symbol mapping
export const CURRENCY_SYMBOLS: { [key: string]: string } = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
  KRW: "₩",
  INR: "₹",
  RUB: "₽",
  TRY: "₺",
  AUD: "A$",
  CAD: "C$",
  CHF: "CHF", // Swiss Franc doesn't have a widely used symbol
  HKD: "HK$",
  SGD: "S$",
  // Cryptocurrencies
  BTC: "₿",
  ETH: "Ξ",
  // Add more currencies as needed
};

function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] || currency;
}

function formatMarketEntry(asset: BaseAsset): string {
  const emoji = getChangeEmoji(asset.percentChange);
  const priceStr = formatPrice(asset.price);
  const changeStr = formatChange(asset.percentChange);
  const symbol = getCurrencySymbol(asset.currency || "USD");
  const name = asset.name || "Unknown";

  return `${emoji} **${name}**: ${symbol}${priceStr} (${changeStr})`;
}

function getAverageChangeColor(changes: number[]): number {
  const sum = changes.reduce((acc, cur) => acc + cur, 0);
  const average = sum / changes.length;
  return getChangeColor(average);
}

function formatCategory(category: { name: string; data: BaseAsset[] }) {
  if (!category || !Array.isArray(category.data)) {
    return {
      name: category.name || "Unknown Category",
      value: "❔ Data unavailable",
      inline: true,
    };
  }

  let headerName = category.name;
  let statusEmoji = "";

  if (category.name === "🇺🇸 US Markets") {
    const status = isMarketOpen("US");
    statusEmoji = ` ${status.emoji}`;
  } else if (category.name === "🇪🇺 European Markets") {
    const status = isMarketOpen("Europe");
    statusEmoji = ` ${status.emoji}`;
  } else if (category.name === "🌏 Asian Markets") {
    const status = isMarketOpen("Asia");
    statusEmoji = ` ${status.emoji}`;
  }

  const formattedEntries = category.data
    .filter((asset) => asset && typeof asset === "object")
    .map((asset) => formatMarketEntry(asset))
    .join("\n");

  return {
    name: headerName + statusEmoji,
    value: formattedEntries || "❔ No data available",
    inline: true,
  };
}

function getDataCredits(): string {
  return "Data provided by Yahoo Finance and CoinGecko";
}

function isWeekend(): boolean {
  const day = new Date().getUTCDay();
  return day === 0 || day === 6; // 0 is Sunday, 6 is Saturday
}

async function formatMarketEmbed(): Promise<EmbedBuilder> {
  try {
    const [traditional, crypto] = await Promise.all([
      getTraditionalMarketData(),
      getCryptoMarketData(),
    ]);

    const embedFields = [];
    const validChanges = [
      ...(traditional.stocks?.us?.data || []),
      ...(traditional.stocks?.europe?.data || []),
      ...(traditional.stocks?.asia?.data || []),
      ...(traditional.forex?.data || []),
      ...(traditional.bonds?.data || []),
    ]
      .map((asset) => asset?.percentChange)
      .filter(Boolean);

    if (traditional) {
      if (traditional.stocks?.us?.data) {
        embedFields.push({
          ...formatCategory({
            ...traditional.stocks.us,
            name: "🇺🇸 US Markets",
          }),
          inline: true,
        });
      }

      if (traditional.stocks?.europe?.data) {
        embedFields.push({
          ...formatCategory({
            ...traditional.stocks.europe,
            name: "🇪🇺 European Markets",
          }),
          inline: true,
        });
      }

      embedFields.push({ name: "\u200B", value: "\u200B", inline: true });

      if (traditional.forex?.data) {
        embedFields.push({
          ...formatCategory({
            ...traditional.forex,
            name: "💱 Exchange Rates",
          }),
          inline: true,
        });
      }

      if (traditional.stocks?.asia?.data) {
        embedFields.push({
          ...formatCategory({
            ...traditional.stocks.asia,
            name: "🌏 Asian Markets",
          }),
          inline: true,
        });
      }

      embedFields.push({ name: "\u200B", value: "\u200B", inline: true });

      if (traditional.bonds?.data) {
        embedFields.push({
          ...formatCategory({
            ...traditional.bonds,
            name: "📈 Treasury Notes",
          }),
          inline: true,
        });
      }
    }

    if (crypto?.coins?.data?.length > 0) {
      embedFields.push({
        name: "₿ Crypto",
        value: crypto.coins.data
          .map((asset) => formatMarketEntry(asset))
          .join("\n"),
        inline: true,
      });
    } else {
      embedFields.push({
        name: "₿ Crypto",
        value: "❔ Crypto market data unavailable",
        inline: true,
      });
    }

    embedFields.push({ name: "\u200B", value: "\u200B", inline: true });

    // If we have no valid fields, show an error message
    if (embedFields.length === 0) {
      embedFields.push({
        name: "❌ Error",
        value: "Unable to retrieve market data. Please try again later.",
        inline: false,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle("📊 Global Markets Overview")
      .setColor(getAverageChangeColor(validChanges))
      .setTimestamp()
      .setFooter({ text: getDataCredits() })
      .addFields(embedFields);

    return embed;
  } catch (error) {
    console.error("Error formatting market embed:", error);
    throw error;
  }
}

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const embed = await formatMarketEmbed();
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error fetching market data:", error);
    await interaction.editReply(
      "Failed to fetch market data. Please try again later.",
    );
  }
}
