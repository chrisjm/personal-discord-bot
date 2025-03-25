import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import * as streakTracker from "../utils/streakTracker";

export const data = new SlashCommandBuilder()
  .setName("water-streak")
  .setDescription("View your water reminder quick response streak status");

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;

  try {
    // Get streak data for the user
    const streakData = await streakTracker.getStreakData(
      userId,
      streakTracker.STREAK_TYPES.WATER_QUICK_RESPONSE
    );

    // Create an embed for streak status
    const embed = new EmbedBuilder()
      .setColor(getStreakColor(streakData.streakLevel))
      .setTitle("💧 Water Reminder Streak Status")
      .setDescription(streakTracker.getStreakStatusMessage(streakData))
      .setFooter({ 
        text: `Quick responses are under ${streakTracker.QUICK_RESPONSE_THRESHOLD_MS / 60000} minutes` 
      })
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  } catch (error) {
    console.error("Error getting streak status:", error);
    await interaction.reply({
      content: "There was an error getting your streak status. Please try again.",
      ephemeral: true,
    });
  }
}

/**
 * Get color for streak level
 */
function getStreakColor(level: string): number {
  switch (level) {
    case streakTracker.STREAK_LEVELS.DIAMOND:
      return 0x9EDDFF; // Light blue for diamond
    case streakTracker.STREAK_LEVELS.GOLD:
      return 0xFFD700; // Gold
    case streakTracker.STREAK_LEVELS.SILVER:
      return 0xC0C0C0; // Silver
    case streakTracker.STREAK_LEVELS.BRONZE:
      return 0xCD7F32; // Bronze
    default:
      return 0x2B65EC; // Default blue
  }
}
