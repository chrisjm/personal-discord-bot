import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import path from "path";

const dbPath = path.join(__dirname, "../../data/sqlite/bot.db");

// Create SQLite client
const client = createClient({
  url: `file:${dbPath}`,
});

// Create Drizzle database instance
export const db = drizzle(client, { schema });

// Export schema for use in other files
export * from "./schema";
