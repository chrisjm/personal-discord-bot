import { text, integer, sqliteTable } from "drizzle-orm/sqlite-core";

export const genericCache = sqliteTable("generic_cache", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  timestamp: integer("timestamp").notNull(),
  ttl: integer("ttl").notNull().default(0),
});
