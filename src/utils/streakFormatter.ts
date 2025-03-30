import {
  StreakRecord,
  UpdateStreakResult,
  getNextLevel,
  getStreakThreshold,
} from "./streakService";
import { STREAK_LEVELS } from "../constants/streaks";

/**
 * Capitalize first letter of a string
 */
export function capitalizeFirstLetter(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Get emoji for streak level
 */
export function getStreakEmoji(level: string): string {
  switch (level) {
    case STREAK_LEVELS.BRONZE:
      return "🥉";
    case STREAK_LEVELS.SILVER:
      return "🥈";
    case STREAK_LEVELS.GOLD:
      return "🥇";
    case STREAK_LEVELS.DIAMOND:
      return "💎";
    default:
      return ""; // No emoji for NONE
  }
}

/**
 * Format the streak update message based on reaction time and update results.
 * @param reactionTimeMs The time taken to react in milliseconds.
 * @param streakResult The result object from the updateStreak function.
 * @returns A formatted string describing the reaction time and streak status.
 */
export function formatStreakUpdateMessage(
  reactionTimeMs: number,
  streakResult: UpdateStreakResult,
): string | null {
  const { streakIncreased, newStreak, newLevel, streakBroken } = streakResult;

  // Base message - always show current streak if it changed or broke
  let messageParts: string[] = [];

  if (streakIncreased) {
    messageParts.push(`🚀 **Streak Increased!** You're now on a **${newStreak}-day** streak!`);
  } else if (streakBroken) {
    messageParts.push(`😢 **Streak Broken.** Back to day 1, but keep going!`);
  } else {
    // Streak didn't increase or break, but was updated (same day interaction)
    // Optionally add a message here, or keep it cleaner by only reporting changes.
    // For now, we won't add a message if it's just a same-day update.
    return null; // Return null if no significant streak event occurred
  }

  // Check for new level achieved
  if (newLevel) {
    const levelEmoji = getStreakEmoji(newLevel);
    messageParts.push(`🎉 ${levelEmoji} **New Level Unlocked:** ${newLevel}!`);
  }

  return messageParts.join("\n"); // Join with newline for better formatting
}

/**
 * Get a formatted message about the user's streak status
 */
export function getStreakStatusMessage(streakData: StreakRecord): string {
  const streakEmoji = getStreakEmoji(streakData.streakLevel);
  const daysText = streakData.currentStreak === 1 ? "day" : "days";

  let message = `${streakEmoji} **Current streak**: ${streakData.currentStreak} ${daysText}\n`;
  message += `🏆 **Longest streak**: ${streakData.longestStreak} days\n`;

  if (streakData.streakLevel !== STREAK_LEVELS.NONE) {
    message += `🎖️ **Current level**: ${capitalizeFirstLetter(
      streakData.streakLevel,
    )}\n`;
  }

  // Show next level info if applicable
  const nextLevel = getNextLevel(streakData.streakLevel);
  if (nextLevel) {
    const threshold = getStreakThreshold(nextLevel);
    const responsesToNextLevel = threshold - streakData.currentStreak;
    if (responsesToNextLevel > 0) {
      const daysNeededText = responsesToNextLevel === 1 ? "day" : "days";
      message += `⬆️ **Next level**: ${capitalizeFirstLetter(nextLevel)} (${responsesToNextLevel} more ${daysNeededText})\n`;
    }
  }

  return message.trim(); // Trim trailing newline if any
}
