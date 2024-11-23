import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getMarketData as getTraditionalMarketData } from "./assets/traditional";
import { getMarketData as getCryptoMarketData } from "./assets/crypto";
import { BaseAsset } from "./core/types";

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

function formatMarketEntry(asset: BaseAsset): string {
  const emoji = getChangeEmoji(asset.percentChange);
  const formattedPrice = formatPrice(asset.price);
  const formattedChange = formatChange(asset.percentChange);

  return `${emoji} **${asset.name}**: $${formattedPrice} (${formattedChange})`;
}

function getAverageChangeColor(changes: number[]): number {
  const sum = changes.reduce((acc, cur) => acc + cur, 0);
  const average = sum / changes.length;
  return getChangeColor(average);
}

async function formatMarketEmbed(): Promise<EmbedBuilder> {
  try {
    const [traditional, crypto] = await Promise.all([
      getTraditionalMarketData(),
      getCryptoMarketData(),
    ]);

    // Format each market category
    const formatCategory = (category: { name: string; data: BaseAsset[] }) => ({
      name: category.name,
      value: category.data.map((asset) => formatMarketEntry(asset)).join("\n"),
      inline: category.name.includes("Markets"), // Stock markets are inline, others are full width
    });

    // Get all asset changes for color calculation
    const allChanges = [
      ...traditional.stocks.us.data,
      ...traditional.stocks.europe.data,
      ...traditional.stocks.asia.data,
      ...traditional.forex.data,
      ...traditional.bonds.data,
      ...crypto.data,
    ].map((asset) => asset.percentChange);

    const embed = new EmbedBuilder()
      .setTitle("📊 Global Markets Overview")
      .setColor(getAverageChangeColor(allChanges))
      .setTimestamp()
      .addFields(
        formatCategory(traditional.stocks.us),
        formatCategory(traditional.stocks.europe),
        formatCategory(traditional.stocks.asia),
        formatCategory(traditional.forex),
        formatCategory(traditional.bonds),
        {
          name: "₿ Crypto",
          value: crypto.data.map((asset) => formatMarketEntry(asset)).join("\n"),
          inline: false,
        }
      );

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
    console.error('Error fetching market data:', error);
    await interaction.editReply('Failed to fetch market data. Please try again later.');
  }
}
