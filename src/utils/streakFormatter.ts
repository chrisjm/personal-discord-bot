import {
  StreakRecord,
  UpdateStreakResult,
  getNextLevel,
  getStreakThreshold,
} from "./streakService";
import {
  STREAK_LEVELS,
  QUICK_RESPONSE_THRESHOLD_MS,
  STREAK_PROTECTION_COOLDOWN_DAYS,
  MS_PER_DAY
} from "../constants/streaks";

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
 * Format reaction time in a user-friendly way with a rating
 * @param reactionTimeMs Reaction time in milliseconds
 * @returns Formatted string with time and rating
 */
export function formatReactionTime(
  reactionTimeMs: number,
): { formatted: string; rating: string; emoji: string } {
  let formatted = "";
  let rating = "";
  let emoji = "";

  if (reactionTimeMs >= QUICK_RESPONSE_THRESHOLD_MS) {
    // If over 10 mins, show only minutes for simplicity
    const minutes = Math.floor(reactionTimeMs / 60000);
    formatted = `${minutes}m`;
  } else {
    // If under 10 mins, show minutes and seconds
    const minutes = Math.floor(reactionTimeMs / 60000);
    const seconds = Math.floor((reactionTimeMs % 60000) / 1000);
    formatted = `${minutes}m ${seconds}s`;
  }

  // Determine rating based on reaction time
  if (reactionTimeMs < 3000) {
    rating = "Lightning Fast";
    emoji = "⚡";
  } else if (reactionTimeMs < 10000) {
    rating = "Super Quick";
    emoji = "🚀";
  } else if (reactionTimeMs < 30000) {
    rating = "Very Fast";
    emoji = "💨";
  } else if (reactionTimeMs < 60000) {
    rating = "Fast";
    emoji = "🏃";
  } else if (reactionTimeMs < 5 * 60000) {
    rating = "Good";
    emoji = "👍";
  } else if (reactionTimeMs < 10 * 60000) {
    rating = "Decent";
    emoji = "👌";
  } else {
    rating = "Slow & Steady";
    emoji = "🐢";
  }

  return { formatted, rating, emoji };
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
): string {
  const { formatted, rating, emoji } = formatReactionTime(reactionTimeMs);
  let message = `${emoji} **Response time**: ${formatted} (${rating})`;

  // Add streak update information if applicable
  if (streakResult.streakUpdated) {
    if (streakResult.protectionUsed) {
      message += `\n🛡️ **Streak Protection Used!** Your streak (${streakResult.newStreak}) continues!`;
    } else if (streakResult.streakBroken) {
      message += "\n⚠️ Your quick response streak was reset.";
      // Level is reset in streakService, no need to mention here unless desired
    } else if (streakResult.streakIncreased) {
      // Only add positive streak info if it actually increased
      message += `\n🔥 **Quick response streak: ${streakResult.newStreak
        }** quick response${streakResult.newStreak !== 1 ? "s" : ""}!`;

      // Add level up message if applicable
      if (streakResult.newLevel) {
        message += `\n🎖️ **LEVEL UP!** You've reached **${capitalizeFirstLetter(streakResult.newLevel)
          }** level!`;
      }
    }
  } else {
    // If streak didn't update (and wasn't broken), it means it was maintained (valid response but not quick)
    if (streakResult.newStreak > 0) {
      // Only show if there's an active streak
      message += `\n✅ Streak maintained at ${streakResult.newStreak} quick response${streakResult.newStreak !== 1 ? "s" : ""
        }.`;
    }
  }

  return message;
}

/**
 * Get a formatted message about the user's streak status
 */
export function getStreakStatusMessage(streakData: StreakRecord): string {
  const streakEmoji = getStreakEmoji(streakData.streakLevel);
  const responsesText = streakData.currentStreak === 1 ? "response" : "responses";

  let message = `${streakEmoji} **Current streak**: ${streakData.currentStreak} quick ${responsesText}\n`;
  message += `🏆 **Longest streak**: ${streakData.longestStreak} quick responses\n`;

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
      message += `⬆️ **Next level**: ${capitalizeFirstLetter(
        nextLevel,
      )} (${responsesToNextLevel} more quick ${responsesToNextLevel === 1 ? "response" : "responses"})\n`;
    }
  }

  // Add streak protection info
  const now = Date.now();
  const protectionAvailable =
    streakData.lastProtectionUsed === null ||
    (now - streakData.lastProtectionUsed) >=
    STREAK_PROTECTION_COOLDOWN_DAYS * MS_PER_DAY;

  if (protectionAvailable && streakData.currentStreak > 0) {
    message += `🛡️ Streak protection available\n`;
  } else if (streakData.currentStreak > 0 && streakData.lastProtectionUsed !== null) {
    // Only show cooldown if protection has been used before
    const msSinceLastProtection = now - streakData.lastProtectionUsed;
    const daysSinceLastProtection = Math.floor(
      msSinceLastProtection / MS_PER_DAY
    );
    const daysUntilProtection =
      STREAK_PROTECTION_COOLDOWN_DAYS - daysSinceLastProtection;

    if (daysUntilProtection > 0) {
      message += `⏳ Streak protection available in ${daysUntilProtection} ${daysUntilProtection === 1 ? "day" : "days"}\n`;
    }
    // If daysUntilProtection <= 0, protection is available (handled by the first check if protectionAvailable is set right)
  }

  return message.trim(); // Trim trailing newline if any
}
