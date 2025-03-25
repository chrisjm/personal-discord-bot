// Import other dependencies statically
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import path from "path";

// Use dynamic import for @libsql/client
let db: ReturnType<typeof drizzle>;

// Initialize database asynchronously
async function initializeDb() {
  try {
    // Dynamic import of @libsql/client
    const { createClient } = await import("@libsql/client");

    const dbPath = path.join(__dirname, "../../data/sqlite/bot.db");

    // Create SQLite client
    const client = createClient({
      url: `file:${dbPath}`,
    });

    // Create Drizzle database instance
    db = drizzle(client, { schema });
    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Failed to initialize database:", error);
    throw error;
  }
}

// Initialize the database immediately
initializeDb();

// Export the database instance and schema
export { db };
