import { db } from "../db";
import { reminderPreferences } from "../db/schema/reminderPreferences";
import { eq, and } from "drizzle-orm";
import { ReminderPreferences } from "../types/reminder";

// Set user preferences
export async function setPreferences(
  prefs: ReminderPreferences,
): Promise<void> {
  try {
    await db
      .insert(reminderPreferences)
      .values({
        userId: prefs.user_id,
        reminderType: prefs.reminder_type,
        enabled: prefs.enabled ? 1 : 0,
        startTime: prefs.start_time,
        endTime: prefs.end_time,
        timezone: prefs.timezone,
        frequencyMinutes: prefs.frequency_minutes,
        random: prefs.random ? 1 : 0,
        frequencyRandomMultiple: prefs.frequency_random_multiple || 1.0,
        lastSent: prefs.last_sent || 0,
      })
      .onConflictDoUpdate({
        target: [reminderPreferences.userId, reminderPreferences.reminderType],
        set: {
          enabled: prefs.enabled ? 1 : 0,
          startTime: prefs.start_time,
          endTime: prefs.end_time,
          timezone: prefs.timezone,
          frequencyMinutes: prefs.frequency_minutes,
          random: prefs.random ? 1 : 0,
          frequencyRandomMultiple: prefs.frequency_random_multiple || 1.0,
          lastSent: prefs.last_sent || 0,
        },
      });
  } catch (err) {
    console.error("Database error in setPreferences:", err);
    throw err;
  }
}

// Get user preferences for a specific reminder type
export async function getPreferences(
  userId: string,
  reminderType: string,
): Promise<ReminderPreferences | null> {
  try {
    const result = await db
      .select()
      .from(reminderPreferences)
      .where(
        and(
          eq(reminderPreferences.userId, userId),
          eq(reminderPreferences.reminderType, reminderType),
        ),
      )
      .limit(1);

    const row = result[0];
    if (!row) return null;

    return {
      user_id: row.userId,
      reminder_type: row.reminderType,
      enabled: row.enabled === 1,
      start_time: row.startTime,
      end_time: row.endTime,
      timezone: row.timezone,
      frequency_minutes: row.frequencyMinutes,
      random: row.random === 1,
      frequency_random_multiple: row.frequencyRandomMultiple,
      last_sent: row.lastSent,
    };
  } catch (err) {
    console.error("Database error in getPreferences:", err);
    throw err;
  }
}

// Get all enabled users for a specific reminder type
export async function getAllEnabledUsers(
  reminderType: string,
): Promise<ReminderPreferences[]> {
  try {
    const rows = await db
      .select()
      .from(reminderPreferences)
      .where(
        and(
          eq(reminderPreferences.enabled, 1),
          eq(reminderPreferences.reminderType, reminderType),
        ),
      );

    return rows.map((row) => ({
      user_id: row.userId,
      reminder_type: row.reminderType,
      enabled: row.enabled === 1,
      start_time: row.startTime,
      end_time: row.endTime,
      timezone: row.timezone,
      frequency_minutes: row.frequencyMinutes || 60,
      random: row.random === 1,
      frequency_random_multiple: row.frequencyRandomMultiple || 1.0,
      last_sent: row.lastSent,
    }));
  } catch (err) {
    console.error("Database error in getAllEnabledUsers:", err);
    throw err;
  }
}

// Update last sent time for a reminder
export async function updateLastSent(
  userId: string,
  reminderType: string,
  timestamp: number,
): Promise<void> {
  try {
    await db
      .update(reminderPreferences)
      .set({ lastSent: timestamp })
      .where(
        and(
          eq(reminderPreferences.userId, userId),
          eq(reminderPreferences.reminderType, reminderType),
        ),
      );
  } catch (err) {
    console.error("Database error in updateLastSent:", err);
    throw err;
  }
}
