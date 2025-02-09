import type { Config } from "drizzle-kit";
import path from "path";

export default {
  schema: "./src/db/schema/*",
  out: "./src/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: `file:${path.join(__dirname, "./data/sqlite/bot.db")}`,
  },
} satisfies Config;
