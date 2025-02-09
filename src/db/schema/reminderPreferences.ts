import { text, integer, real, sqliteTable, primaryKey } from "drizzle-orm/sqlite-core";

export const reminderPreferences = sqliteTable("reminder_preferences", {
  userId: text("user_id").notNull(),
  reminderType: text("reminder_type").notNull(),
  enabled: integer("enabled").notNull().default(0),
  startTime: text("start_time").notNull().default("08:00"),
  endTime: text("end_time").notNull().default("19:00"),
  timezone: text("timezone").notNull().default("America/Los_Angeles"),
  frequencyMinutes: integer("frequency_minutes").notNull(),
  random: integer("random").notNull().default(0),
  frequencyRandomMultiple: real("frequency_random_multiple").notNull().default(1.0),
  lastSent: integer("last_sent").notNull().default(0)
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.reminderType] })
}));
