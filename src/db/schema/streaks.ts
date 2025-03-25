import { text, integer, sqliteTable } from "drizzle-orm/sqlite-core";

export const streaks = sqliteTable("streaks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  streakType: text("streak_type").notNull(),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastUpdated: integer("last_updated").notNull(),
  protectionUsed: integer("protection_used").notNull().default(0),
  lastProtectionUsed: integer("last_protection_used"),
  streakLevel: text("streak_level").notNull().default("none"),
});
