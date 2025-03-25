import { db } from "../db";
import { streaks } from "../db/schema/streaks";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

// Constants for streak system
export const STREAK_TYPES = {
  WATER_QUICK_RESPONSE: "water_quick_response",
};

export const STREAK_LEVELS = {
  NONE: "none",
  BRONZE: "bronze",
  SILVER: "silver",
  GOLD: "gold",
  DIAMOND: "diamond",
};

export const STREAK_THRESHOLDS = {
  BRONZE: 3,   // 3 days
  SILVER: 7,   // 7 days
  GOLD: 14,    // 14 days
  DIAMOND: 30, // 30 days
};

export const QUICK_RESPONSE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
export const STREAK_PROTECTION_COOLDOWN_DAYS = 7; // Can use protection once per week
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  streakLevel: string;
  protectionAvailable: boolean;
  protectionUsed: number;
  lastUpdated: number;
  lastProtectionUsed: number | null;
}

/**
 * Initialize a streak record for a user if it doesn't exist
 */
export async function initializeStreak(userId: string, streakType: string): Promise<void> {
  try {
    // Check if streak record already exists
    const existingStreak = await db
      .select()
      .from(streaks)
      .where(
        and(
          eq(streaks.userId, userId),
          eq(streaks.streakType, streakType)
        )
      );

    if (existingStreak.length === 0) {
      // Create new streak record
      await db.insert(streaks).values({
        id: randomUUID(),
        userId,
        streakType,
        currentStreak: 0,
        longestStreak: 0,
        lastUpdated: Date.now(),
        protectionUsed: 0,
        streakLevel: STREAK_LEVELS.NONE,
      });
    }
  } catch (err) {
    console.error("Database error in initializeStreak:", err);
    throw err;
  }
}

/**
 * Update a user's streak based on their reaction time
 * Returns information about streak changes
 */
export async function updateStreak(
  userId: string,
  streakType: string,
  reactionTimeMs: number
): Promise<{
  streakUpdated: boolean;
  streakIncreased: boolean;
  newStreak: number;
  newLevel: string | null;
  streakBroken: boolean;
  protectionUsed: boolean;
}> {
  try {
    // Ensure streak record exists
    await initializeStreak(userId, streakType);

    // Get current streak data
    const streakData = await getStreakData(userId, streakType);

    const now = Date.now();
    const daysSinceLastUpdate = Math.floor((now - streakData.lastUpdated) / MS_PER_DAY);

    let streakIncreased = false;
    let streakBroken = false;
    let protectionUsed = false;
    let newLevel = null;

    // Check if this is a quick response
    const isQuickResponse = reactionTimeMs <= QUICK_RESPONSE_THRESHOLD_MS;

    // Default update values
    let updatedStreak = streakData.currentStreak;

    // Check if we need to update the streak
    if (daysSinceLastUpdate > 1) {
      // More than 1 day has passed, check if we can use streak protection
      const canUseProtection =
        (streakData.lastProtectionUsed === undefined ||
         streakData.lastProtectionUsed === null ||
         (now - streakData.lastProtectionUsed) >= STREAK_PROTECTION_COOLDOWN_DAYS * MS_PER_DAY);

      if (canUseProtection && streakData.currentStreak > 0) {
        // Use streak protection
        protectionUsed = true;
        // Streak remains the same, just update protection usage
      } else {
        // Break streak
        updatedStreak = isQuickResponse ? 1 : 0; // Start new streak if quick response
        streakBroken = true;
      }
    } else if (daysSinceLastUpdate === 1 || streakData.currentStreak === 0) {
      // Exactly 1 day has passed or starting a new streak
      if (isQuickResponse) {
        updatedStreak = streakData.currentStreak + 1;
        streakIncreased = true;
      }
    } else if (daysSinceLastUpdate === 0) {
      // Same day, no streak update needed
      // This prevents multiple reminders in the same day from increasing the streak
    }

    // Calculate new streak level if streak increased
    if (streakIncreased) {
      if (updatedStreak >= STREAK_THRESHOLDS.DIAMOND && streakData.streakLevel !== STREAK_LEVELS.DIAMOND) {
        newLevel = STREAK_LEVELS.DIAMOND;
      } else if (updatedStreak >= STREAK_THRESHOLDS.GOLD && streakData.streakLevel !== STREAK_LEVELS.GOLD) {
        newLevel = STREAK_LEVELS.GOLD;
      } else if (updatedStreak >= STREAK_THRESHOLDS.SILVER && streakData.streakLevel !== STREAK_LEVELS.SILVER) {
        newLevel = STREAK_LEVELS.SILVER;
      } else if (updatedStreak >= STREAK_THRESHOLDS.BRONZE && streakData.streakLevel !== STREAK_LEVELS.BRONZE) {
        newLevel = STREAK_LEVELS.BRONZE;
      }
    }

    // Update streak in database
    await db
      .update(streaks)
      .set({
        currentStreak: updatedStreak,
        longestStreak: Math.max(updatedStreak, streakData.longestStreak),
        lastUpdated: now,
        protectionUsed: protectionUsed ? streakData.protectionUsed + 1 : streakData.protectionUsed,
        lastProtectionUsed: protectionUsed ? now : streakData.lastProtectionUsed,
        streakLevel: newLevel || streakData.streakLevel,
      })
      .where(
        and(
          eq(streaks.userId, userId),
          eq(streaks.streakType, streakType)
        )
      );

    return {
      streakUpdated: streakIncreased || streakBroken || protectionUsed,
      streakIncreased,
      newStreak: updatedStreak,
      newLevel,
      streakBroken,
      protectionUsed,
    };
  } catch (err) {
    console.error("Database error in updateStreak:", err);
    throw err;
  }
}

/**
 * Get a user's streak data
 */
export async function getStreakData(userId: string, streakType: string): Promise<StreakData> {
  try {
    // Ensure streak record exists
    await initializeStreak(userId, streakType);

    const streakData = await db
      .select()
      .from(streaks)
      .where(
        and(
          eq(streaks.userId, userId),
          eq(streaks.streakType, streakType)
        )
      );

    if (streakData.length === 0) {
      throw new Error(`No streak data found for user ${userId} and type ${streakType}`);
    }

    const data = streakData[0];
    const now = Date.now();

    // Check if protection is available
    const protectionAvailable =
      (data.lastProtectionUsed === null ||
       data.lastProtectionUsed === undefined ||
       (now - data.lastProtectionUsed) >= STREAK_PROTECTION_COOLDOWN_DAYS * MS_PER_DAY);

    return {
      currentStreak: data.currentStreak,
      longestStreak: data.longestStreak,
      streakLevel: data.streakLevel,
      protectionAvailable,
      protectionUsed: data.protectionUsed,
      lastUpdated: data.lastUpdated,
      lastProtectionUsed: data.lastProtectionUsed,
    };
  } catch (err) {
    console.error("Database error in getStreakData:", err);
    throw err;
  }
}

/**
 * Get a formatted message about the user's streak status
 */
export function getStreakStatusMessage(streakData: StreakData): string {
  const streakEmoji = getStreakEmoji(streakData.streakLevel);
  const daysText = streakData.currentStreak === 1 ? "day" : "days";

  let message = `${streakEmoji} **Current streak**: ${streakData.currentStreak} ${daysText}\n`;
  message += `🏆 **Longest streak**: ${streakData.longestStreak} days\n`;

  if (streakData.streakLevel !== STREAK_LEVELS.NONE) {
    message += `🎖️ **Current level**: ${capitalizeFirstLetter(streakData.streakLevel)}\n`;
  }

  // Show next level info if applicable
  const nextLevel = getNextLevel(streakData.streakLevel);
  if (nextLevel) {
    const daysToNextLevel = getStreakThreshold(nextLevel) - streakData.currentStreak;
    if (daysToNextLevel > 0) {
      message += `⬆️ **Next level**: ${capitalizeFirstLetter(nextLevel)} (${daysToNextLevel} more ${daysToNextLevel === 1 ? 'day' : 'days'})\n`;
    }
  }

  // Add streak protection info
  if (streakData.protectionAvailable && streakData.currentStreak > 0) {
    message += `🛡️ Streak protection available\n`;
  } else if (streakData.currentStreak > 0) {
    const lastProtection = streakData.lastUpdated;
    const daysUntilProtection = STREAK_PROTECTION_COOLDOWN_DAYS -
      Math.floor((Date.now() - lastProtection) / MS_PER_DAY);

    if (daysUntilProtection > 0) {
      message += `⏳ Streak protection available in ${daysUntilProtection} ${daysUntilProtection === 1 ? 'day' : 'days'}\n`;
    }
  }

  return message;
}

/**
 * Get emoji for streak level
 */
function getStreakEmoji(level: string): string {
  switch (level) {
    case STREAK_LEVELS.DIAMOND:
      return "💎";
    case STREAK_LEVELS.GOLD:
      return "🥇";
    case STREAK_LEVELS.SILVER:
      return "🥈";
    case STREAK_LEVELS.BRONZE:
      return "🥉";
    default:
      return "🔥";
  }
}

/**
 * Get the next level based on current level
 */
function getNextLevel(currentLevel: string): string | null {
  switch (currentLevel) {
    case STREAK_LEVELS.NONE:
      return STREAK_LEVELS.BRONZE;
    case STREAK_LEVELS.BRONZE:
      return STREAK_LEVELS.SILVER;
    case STREAK_LEVELS.SILVER:
      return STREAK_LEVELS.GOLD;
    case STREAK_LEVELS.GOLD:
      return STREAK_LEVELS.DIAMOND;
    default:
      return null;
  }
}

/**
 * Get threshold for a streak level
 */
function getStreakThreshold(level: string): number {
  switch (level) {
    case STREAK_LEVELS.BRONZE:
      return STREAK_THRESHOLDS.BRONZE;
    case STREAK_LEVELS.SILVER:
      return STREAK_THRESHOLDS.SILVER;
    case STREAK_LEVELS.GOLD:
      return STREAK_THRESHOLDS.GOLD;
    case STREAK_LEVELS.DIAMOND:
      return STREAK_THRESHOLDS.DIAMOND;
    default:
      return 0;
  }
}

/**
 * Capitalize first letter of a string
 */
function capitalizeFirstLetter(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Format reaction time in a user-friendly way with a rating
 * @param reactionTimeMs Reaction time in milliseconds
 * @returns Formatted string with time and rating
 */
export function formatReactionTime(reactionTimeMs: number): { formatted: string; rating: string; emoji: string } {
  let formatted: string;
  let rating: string;
  let emoji: string;
  
  // Format the time
  if (reactionTimeMs < 1000) {
    // Under a second
    formatted = `${reactionTimeMs}ms`;
  } else if (reactionTimeMs < 60000) {
    // Under a minute
    const seconds = (reactionTimeMs / 1000).toFixed(1);
    formatted = `${seconds}s`;
  } else {
    // Over a minute
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
