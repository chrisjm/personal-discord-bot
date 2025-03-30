// Constants for streak system
export const STREAK_TYPES = {
  // Deprecated for gamification, kept for potential data analysis
  // WATER_QUICK_RESPONSE: "water_quick_response",
  WATER_DAILY_CONSISTENCY: "water_daily_consistency",
  // Add other streak types here if needed
};

export const STREAK_LEVELS = {
  NONE: "none",
  BRONZE: "bronze",
  SILVER: "silver",
  GOLD: "gold",
  DIAMOND: "diamond",
};

export const STREAK_THRESHOLDS = {
  BRONZE: 3,   // 3 consecutive quick responses
  SILVER: 7,   // 7 consecutive quick responses
  GOLD: 14,    // 14 consecutive quick responses
  DIAMOND: 30, // 30 consecutive quick responses
};

export const MAX_REACTION_TIME_MS = 3600000; // 60 minutes (keep for tracking reaction timeout)

export const MS_PER_DAY = 24 * 60 * 60 * 1000;
