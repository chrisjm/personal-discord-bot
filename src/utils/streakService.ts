import { db } from "../db";
import { streaks } from "../db/schema/streaks";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  STREAK_LEVELS,
  STREAK_THRESHOLDS,
  MS_PER_DAY,
} from "../constants/streaks";

// Renamed from StreakData - removed protectionAvailable as it's derived
export interface StreakRecord {
  currentStreak: number;
  longestStreak: number;
  streakLevel: string;
  lastUpdated: number;
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
};

// Helper function to get the day number (days since epoch)
const getDayNumber = (timestamp: number): number => {
  return Math.floor(timestamp / MS_PER_DAY);
};

/**
 * Update a user's **daily consistency** streak.
 * Increases if the update is on the day after the last update.
 * Resets to 1 if the update is more than one day after the last update.
 * Does nothing if the update is on the same day as the last update.
 * Returns information about streak changes.
 */
export async function updateStreak(
  userId: string,
  streakType: string
): Promise<UpdateStreakResult> {
  try {
    // Ensure streak record exists
    await initializeStreak(userId, streakType);

    // Get current streak data
    const streakData = await getStreakData(userId, streakType);

    const now = Date.now();
    const currentDayNumber = getDayNumber(now);
    const lastUpdateDayNumber = getDayNumber(streakData.lastUpdated);

    let streakIncreased = false;
    let streakBroken = false;
    let newLevel: string | null = null;
    let updatedStreak = streakData.currentStreak;
    let needsDbUpdate = false;
    let finalLevel = streakData.streakLevel; // Start with current level

    // --- Check 1: Is this the very first interaction for this streak period? ---
    if (streakData.currentStreak === 0) {
      updatedStreak = 1;
      streakIncreased = true;
      needsDbUpdate = true;
      finalLevel = STREAK_LEVELS.BRONZE;
      if (finalLevel !== streakData.streakLevel) {
        newLevel = finalLevel;
      }
      console.log(`[Streak] User ${userId} (${streakType}): Streak started! Set to ${updatedStreak}`);
    }
    // --- Check 2: Interaction on a different day, and streak was already active ---
    else if (currentDayNumber > lastUpdateDayNumber) {
      needsDbUpdate = true;

      if (currentDayNumber === lastUpdateDayNumber + 1) {
        // Interaction is on the consecutive day, increase streak
        updatedStreak = streakData.currentStreak + 1;
        streakIncreased = true;
        console.log(`[Streak] User ${userId} (${streakType}): Consecutive day interaction. Streak increased to ${updatedStreak}`);
      } else {
        // Interaction is more than one day after the last update, streak broken
        updatedStreak = 1;
        streakBroken = true;
        streakIncreased = false;
        finalLevel = STREAK_LEVELS.BRONZE;
        console.log(`[Streak] User ${userId} (${streakType}): Missed day(s). Streak reset to 1.`);
      }

      // Check for new level if streak changed (only if not already reset to Bronze)
      if (!streakBroken) {
        if (updatedStreak >= STREAK_THRESHOLDS.DIAMOND && streakData.streakLevel !== STREAK_LEVELS.DIAMOND) {
          finalLevel = STREAK_LEVELS.DIAMOND;
        } else if (updatedStreak >= STREAK_THRESHOLDS.GOLD && streakData.streakLevel !== STREAK_LEVELS.GOLD) {
          finalLevel = STREAK_LEVELS.GOLD;
        } else if (updatedStreak >= STREAK_THRESHOLDS.SILVER && streakData.streakLevel !== STREAK_LEVELS.SILVER) {
          finalLevel = STREAK_LEVELS.SILVER;
        } else if (updatedStreak >= STREAK_THRESHOLDS.BRONZE && streakData.streakLevel !== STREAK_LEVELS.BRONZE) {
          finalLevel = STREAK_LEVELS.BRONZE;
        }
      }

      // Record if the level actually changed
      if (finalLevel !== streakData.streakLevel) {
        newLevel = finalLevel;
      }

    }
    // --- Check 3: Interaction on the same day, and streak was already active ---
    else if (currentDayNumber === lastUpdateDayNumber && streakData.currentStreak > 0) {
      // Interaction is on the same day as the last update, and streak > 0. Do nothing.
      console.log(`[Streak] User ${userId} (${streakType}): Same day interaction. Streak remains ${updatedStreak}`);
      needsDbUpdate = false;
    }

    // Update streak in database only if something changed
    if (needsDbUpdate) {
      await db
        .update(streaks)
        .set({
          currentStreak: updatedStreak,
          longestStreak: Math.max(updatedStreak, streakData.longestStreak),
          lastUpdated: now,
          streakLevel: finalLevel,
        })
        .where(
          and(
            eq(streaks.userId, userId),
            eq(streaks.streakType, streakType)
          )
        );
      console.log(`[Streak] User ${userId} (${streakType}): DB updated. New Streak: ${updatedStreak}, Level: ${finalLevel}, Last Updated: ${new Date(now).toISOString()}`);

    } else {
      console.log(`[Streak] User ${userId} (${streakType}): No DB update needed.`);
    }

    return {
      streakUpdated: needsDbUpdate,
      streakIncreased,
      newStreak: updatedStreak,
      newLevel,
      streakBroken,
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

    // Return a mapped object matching StreakRecord, excluding removed fields
    return {
      currentStreak: data.currentStreak,
      longestStreak: data.longestStreak,
      streakLevel: data.streakLevel || STREAK_LEVELS.NONE, // Ensure level is never null/undefined
      lastUpdated: data.lastUpdated,
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
