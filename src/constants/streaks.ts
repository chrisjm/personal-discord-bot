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
  BRONZE: 3,   // 3 consecutive quick responses
  SILVER: 7,   // 7 consecutive quick responses
  GOLD: 14,    // 14 consecutive quick responses
  DIAMOND: 30, // 30 consecutive quick responses
};

export const QUICK_RESPONSE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
export const MAX_REACTION_TIME_MS = 60 * 60 * 1000; // 60 minutes
export const STREAK_PROTECTION_COOLDOWN_DAYS = 7; // Can use protection once per week
export const MS_PER_DAY = 24 * 60 * 60 * 1000;
