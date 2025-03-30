import { db } from "../db";
import { tracking } from "../db/schema/tracking";
import { eq, and, between } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface TrackingEntry {
  entry_datetime: string;
  type: string;
  amount: number;
  unit: string;
  note: string | null;
}

export async function addEntry(
  userId: string,
  type: string,
  amount: number,
  unit: string,
  note?: string,
): Promise<string> {
  const entry_datetime = new Date().toISOString();
  console.log("Adding entry in UTC:", {
    type,
    amount,
    unit,
    note,
    entry_datetime,
  });

  try {
    await db.insert(tracking).values({
      id: randomUUID(),
      userId,
      type,
      value: JSON.stringify({ amount, unit, note, entry_datetime }),
      timestamp: Date.now(),
    });
    return `Successfully tracked ${amount}${unit} of ${type}!`;
  } catch (err) {
    console.error("Database error in addEntry:", err);
    throw err;
  }
}

export async function getEntriesInRange(
  userId: string,
  type: string,
  startDate: string,
  endDate: string,
): Promise<TrackingEntry[]> {
  console.log("Fetching entries in UTC range:", { type, startDate, endDate });

  try {
    const startTimestamp = new Date(startDate).getTime();
    const endTimestamp = new Date(endDate).getTime();

    const entries = await db
      .select()
      .from(tracking)
      .where(
        and(
          eq(tracking.userId, userId),
          eq(tracking.type, type),
          between(tracking.timestamp, startTimestamp, endTimestamp),
        ),
      );

    return entries.map((entry) => {
      const value = JSON.parse(entry.value);
      return {
        entry_datetime: value.entry_datetime,
        type: entry.type,
        amount: value.amount,
        unit: value.unit,
        note: value.note,
      };
    });
  } catch (err) {
    console.error("Database error in getEntriesInRange:", err);
    throw err;
  }
}

export async function getEntriesForDay(
  userId: string,
  type: string,
  date: string,
): Promise<TrackingEntry[]> {
  console.log("Fetching entries for day in UTC:", { type, date });

  try {
    const startTimestamp = new Date(date + "T00:00:00.000Z").getTime();
    const endTimestamp = new Date(date + "T23:59:59.999Z").getTime();

    const entries = await db
      .select()
      .from(tracking)
      .where(
        and(
          eq(tracking.userId, userId),
          eq(tracking.type, type),
          between(tracking.timestamp, startTimestamp, endTimestamp),
        ),
      );

    return entries.map((entry) => {
      const value = JSON.parse(entry.value);
      return {
        entry_datetime: value.entry_datetime,
        type: entry.type,
        amount: value.amount,
        unit: value.unit,
        note: value.note,
      };
    });
  } catch (err) {
    console.error("Database error in getEntriesForDay:", err);
    throw err;
  }
}

/**
 * Get the total amount for a specific tracking type on a given day.
 * @param userId The user ID.
 * @param type The tracking type (e.g., "water").
 * @param date The date string in YYYY-MM-DD format.
 * @returns The sum of amounts for that day.
 */
export async function getTotalForDay(
  userId: string,
  type: string,
  date: string
): Promise<number> {
  try {
    const entries = await getEntriesForDay(userId, type, date);
    const total = entries.reduce((sum, entry) => sum + entry.amount, 0);
    console.log(`[DB] Total ${type} for user ${userId} on ${date}: ${total}`);
    return total;
  } catch (err) {
    console.error("Database error in getTotalForDay:", err);
    throw err;
  }
}
