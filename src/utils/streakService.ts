import { db } from "../db";
import { streaks } from "../db/schema/streaks";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  STREAK_LEVELS,
  STREAK_THRESHOLDS,
  QUICK_RESPONSE_THRESHOLD_MS,
  MAX_REACTION_TIME_MS,
  STREAK_PROTECTION_COOLDOWN_DAYS,
  MS_PER_DAY,
} from "../constants/streaks";

// Renamed from StreakData - removed protectionAvailable as it's derived
export interface StreakRecord {
  currentStreak: number;
  longestStreak: number;
  streakLevel: string;
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

// Helper type for the result of updateStreak
export type UpdateStreakResult = {
  streakUpdated: boolean;
  streakIncreased: boolean;
  newStreak: number;
  newLevel: string | null;
  streakBroken: boolean;
  protectionUsed: boolean;
};

/**
 * Update a user's streak based on their reaction time
 * Returns information about streak changes
 */
export async function updateStreak(
  userId: string,
  streakType: string,
  reactionTimeMs: number
): Promise<UpdateStreakResult> {
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

    // Check if this is a quick response (within the threshold)
    const isQuickResponse = reactionTimeMs <= QUICK_RESPONSE_THRESHOLD_MS;

    // Default update values
    let updatedStreak = streakData.currentStreak;

    // Check if the response is within the maximum allowed time
    const isWithinMaxTime = reactionTimeMs <= MAX_REACTION_TIME_MS;

    if (!isWithinMaxTime) {
      // Response is too slow, check if we can use streak protection
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
        updatedStreak = 0;
        streakBroken = true;
      }
    } else if (isQuickResponse) {
      // Quick response, increase streak
      updatedStreak = streakData.currentStreak + 1;
      streakIncreased = true;
    } else {
      // Response is within max time but not quick enough
      // Don't increase streak, but don't break it either
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
        // Reset level if streak broken, otherwise update if new level reached
        streakLevel: streakBroken
          ? STREAK_LEVELS.NONE
          : newLevel || streakData.streakLevel,
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
 * Note: This returns the raw record. Availability of protection should be checked where needed.
 */
export async function getStreakData(userId: string, streakType: string): Promise<StreakRecord> {
  try {
    // Ensure streak record exists
    await initializeStreak(userId, streakType);

    const results = await db
      .select()
      .from(streaks)
      .where(
        and(
          eq(streaks.userId, userId),
          eq(streaks.streakType, streakType)
        )
      );

    if (results.length === 0) {
      // This case should ideally be handled by initializeStreak, but good to check
      console.error(`No streak data found for user ${userId} after initialization attempt.`);
      // Consider returning a default StreakRecord or throwing a more specific error
      throw new Error(`No streak data found for user ${userId} and type ${streakType}`);
    }

    const data = results[0];

    // Return the raw data; calculation of protection availability is moved to callers/formatters
    return {
      currentStreak: data.currentStreak,
      longestStreak: data.longestStreak,
      streakLevel: data.streakLevel,
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
 * Get the next level based on current level
 */
export function getNextLevel(currentLevel: string): string | null {
  switch (currentLevel) {
    case STREAK_LEVELS.NONE:
      return STREAK_LEVELS.BRONZE;
    case STREAK_LEVELS.BRONZE:
      return STREAK_LEVELS.SILVER;
    case STREAK_LEVELS.SILVER:
      return STREAK_LEVELS.GOLD;
    case STREAK_LEVELS.GOLD:
      return STREAK_LEVELS.DIAMOND;
    case STREAK_LEVELS.DIAMOND:
      return null; // Max level
    default:
      return STREAK_LEVELS.BRONZE; // Should not happen
  }
}

/**
 * Get threshold for a streak level
 */
export function getStreakThreshold(level: string): number {
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
      return Infinity; // Should not happen
  }
}
