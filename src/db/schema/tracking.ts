import { text, integer, sqliteTable } from "drizzle-orm/sqlite-core";

export const tracking = sqliteTable("tracking", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  value: text("value").notNull(),
  timestamp: integer("timestamp").notNull(),
});
