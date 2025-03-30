import {
  StreakRecord,
  UpdateStreakResult,
  getNextLevel,
  getStreakThreshold,
} from "./streakService";
import { STREAK_LEVELS, STREAK_THRESHOLDS } from "../constants/streaks";

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
 * Information about the next streak level.
 */
export interface NextLevelInfo {
  nextLevelName: string;
  daysToNextLevel: number;
}

/**
 * Calculate the next streak level and days required.
 * @param currentStreak The user's current streak count.
 * @returns An object containing the next level name and days needed, or null if at max level.
 */
export function getDaysToNextLevelInfo(
  currentStreak: number
): NextLevelInfo | null {
  if (currentStreak >= STREAK_THRESHOLDS.DIAMOND) {
    return null; // Already at max level
  }

  let nextLevelName = STREAK_LEVELS.BRONZE;
  let daysToNextLevel = STREAK_THRESHOLDS.BRONZE - currentStreak;

  if (currentStreak >= STREAK_THRESHOLDS.BRONZE) {
    nextLevelName = STREAK_LEVELS.SILVER;
    daysToNextLevel = STREAK_THRESHOLDS.SILVER - currentStreak;
  }
  if (currentStreak >= STREAK_THRESHOLDS.SILVER) {
    nextLevelName = STREAK_LEVELS.GOLD;
    daysToNextLevel = STREAK_THRESHOLDS.GOLD - currentStreak;
  }
  if (currentStreak >= STREAK_THRESHOLDS.GOLD) {
    nextLevelName = STREAK_LEVELS.DIAMOND;
    daysToNextLevel = STREAK_THRESHOLDS.DIAMOND - currentStreak;
  }

  return {
    nextLevelName: capitalizeFirstLetter(nextLevelName),
    daysToNextLevel: Math.max(1, daysToNextLevel), // Ensure at least 1 day
  };
}

/**
 * Format the streak update message based on streak changes and daily water intake.
 * @param streakResult The result object from the updateStreak function.
 * @param dailyIntakeMl The total water intake for the current day in milliliters.
 * @param dailyTargetMl The target water intake for the day.
 * @returns A formatted string describing the streak status or encouragement, or null if no message is needed.
 */
export function formatStreakUpdateMessage(
  streakResult: UpdateStreakResult,
  dailyIntakeMl: number,
  dailyTargetMl: number
): string | null {
  const { streakIncreased, newStreak, newLevel, streakBroken } = streakResult;
  const messageParts: string[] = [];

  if (streakIncreased) {
    if (newStreak === 1) { // Started a new streak
      messageParts.push(`🔥 **New Streak Started!** You're on day 1!`);
    } else {
      messageParts.push(`🚀 **Streak Increased!** You're now on a **${newStreak}-day** streak!`);
    }

    // Check for new level unlocked
    if (newLevel) {
      const levelEmoji = getStreakEmoji(newLevel);
      messageParts.push(`🎉 ${levelEmoji} **Level Unlocked:** ${capitalizeFirstLetter(newLevel)}!`);
    }

    // Add info about next level
    const nextLevelInfo = getDaysToNextLevelInfo(newStreak);
    if (nextLevelInfo) {
      const daysText = nextLevelInfo.daysToNextLevel === 1 ? "day" : "days";
      messageParts.push(`➡️ Keep it up for **${nextLevelInfo.daysToNextLevel}** more ${daysText} to reach **${nextLevelInfo.nextLevelName}**!`);
    } else {
      // At Diamond level or beyond
      messageParts.push(`💎 You've reached the highest level! Incredible consistency!`);
    }

  } else if (streakBroken) {
    messageParts.push(`😢 **Streak Broken.** Don't worry, a new streak starts now (day 1)!`);
    const nextLevelInfo = getDaysToNextLevelInfo(1); // Info for getting back to Bronze
    if (nextLevelInfo) {
       const daysText = nextLevelInfo.daysToNextLevel === 1 ? "day" : "days";
       messageParts.push(`➡️ Keep it up for **${nextLevelInfo.daysToNextLevel}** more ${daysText} to reach **${nextLevelInfo.nextLevelName}**!`);
    }

  } else {
    // Streak didn't increase or break (e.g., same day interaction)
    const remainingMl = dailyTargetMl - dailyIntakeMl;
    if (remainingMl > 0) {
      messageParts.push(`💧 Keep going! Just **${remainingMl}ml** more water to hit your daily goal of ${dailyTargetMl}ml!`);
    } else {
      messageParts.push(`✅ Great job! You've hit your daily water goal of ${dailyTargetMl}ml! (${dailyIntakeMl}ml logged)`);
    }
  }

  return messageParts.length > 0 ? messageParts.join("\n") : null;
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
