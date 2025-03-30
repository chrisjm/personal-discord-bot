import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getStreakData, StreakRecord } from "../utils/streakService";
import { getStreakStatusMessage } from "../utils/streakFormatter";
import { 
  STREAK_TYPES, 
  STREAK_LEVELS, 
  QUICK_RESPONSE_THRESHOLD_MS, 
  MAX_REACTION_TIME_MS 
} from "../constants/streaks"; 

export const data = new SlashCommandBuilder()
  .setName("water-streak")
  .setDescription("View your water reminder quick response streak status");

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;

  try {
    // Get streak data for the user using the new service
    const streakData: StreakRecord | null = await getStreakData(
      userId,
      STREAK_TYPES.WATER_QUICK_RESPONSE
    );

    // Create an embed for streak status
    const embed = new EmbedBuilder();

    if (streakData) {
      embed
        .setColor(getStreakColor(streakData.streakLevel))
        .setTitle("💧 Water Reminder Streak Status")
        .setDescription(getStreakStatusMessage(streakData))
        .setFooter({ 
          text: `Quick responses are under ${QUICK_RESPONSE_THRESHOLD_MS / (60 * 1000)} minutes. Max reaction time allowed: ${MAX_REACTION_TIME_MS / (60 * 1000)} minutes.`
        })
        .setTimestamp();
    } else {
      embed
        .setColor(0x2B65EC)
        .setTitle("💧 Water Reminder Streak Status")
        .setDescription("You haven't started tracking your water reminder streaks yet!")
        .setFooter({ 
          text: `Quick responses are under ${QUICK_RESPONSE_THRESHOLD_MS / (60 * 1000)} minutes. Max reaction time allowed: ${MAX_REACTION_TIME_MS / (60 * 1000)} minutes.`
        })
        .setTimestamp();
    }

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
    case STREAK_LEVELS.DIAMOND:
      return 0x9EDDFF;
    case STREAK_LEVELS.GOLD:
      return 0xFFD700;
    case STREAK_LEVELS.SILVER:
      return 0xC0C0C0;
    case STREAK_LEVELS.BRONZE:
      return 0xCD7F32;
    default:
      return 0x2B65EC;
  }
}
