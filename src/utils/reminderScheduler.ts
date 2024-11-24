import { Client } from "discord.js";
import * as reminderDb from "./reminderDatabase";
import { ReminderHandler, ReminderPreferences } from "../types/reminder";

const spacetimeImport = import("spacetime");

// State management
let discordClient: Client | null = null;
const userTimers: Map<string, NodeJS.Timeout> = new Map();
const reminderHandlers: Map<string, ReminderHandler> = new Map();

// Core functionality
export const setClient = (client: Client): void => {
  discordClient = client;
};

export const registerHandler = (handler: ReminderHandler): void => {
  reminderHandlers.set(handler.type, handler);
};

const getTimerKey = (userId: string, reminderType: string): string => {
  return `${userId}:${reminderType}`;
};

const scheduleNextReminder = (
  userId: string,
  prefs: ReminderPreferences,
): void => {
  const handler = reminderHandlers.get(prefs.reminder_type);
  if (!handler) {
    console.error(`No handler found for reminder type: ${prefs.reminder_type}`);
    return;
  }

  const interval = prefs.frequency_minutes
    ? prefs.frequency_minutes * 60 * 1000
    : handler.defaultFrequencyMinutes * 60 * 1000;

  const timerKey = getTimerKey(userId, prefs.reminder_type);
  const timer = setTimeout(
    () => sendReminder(userId, prefs.reminder_type),
    interval,
  );

  // Clear any existing timer before setting a new one
  if (userTimers.has(timerKey)) {
    clearTimeout(userTimers.get(timerKey));
  }

  userTimers.set(timerKey, timer);
};

const sendReminder = async (
  userId: string,
  reminderType: string,
): Promise<void> => {
  if (!discordClient) return;

  try {
    const spacetime = (await spacetimeImport).default;
    const prefs = await reminderDb.getPreferences(userId, reminderType);
    const handler = reminderHandlers.get(reminderType);

    if (!prefs || !prefs.enabled || !handler) {
      stopReminders(userId, reminderType);
      return;
    }

    const now = spacetime.now(prefs.timezone);

    // Convert start and end times to spacetime objects for proper comparison
    const [startHour, startMinute] = prefs.start_time.split(":").map(Number);
    const [endHour, endMinute] = prefs.end_time.split(":").map(Number);

    const startTime = now.clone().hour(startHour).minute(startMinute);
    const endTime = now.clone().hour(endHour).minute(endMinute);

    // Check if current time is within the reminder window
    if (now.isBetween(startTime, endTime)) {
      console.log(`[DEBUG] Sending ${reminderType} reminder to user ${userId}`);
      await handler.onReminder(discordClient, userId);
      scheduleNextReminder(userId, prefs);
    } else {
      // If outside reminder window, schedule for next start time
      const nextStart = now.isBefore(startTime)
        ? startTime
        : startTime.add(1, "day");
      const msUntilStart = nextStart.epoch - now.epoch;

      const timerKey = getTimerKey(userId, reminderType);
      const timer = setTimeout(
        () => sendReminder(userId, reminderType),
        msUntilStart,
      );

      if (userTimers.has(timerKey)) {
        clearTimeout(userTimers.get(timerKey));
      }
      userTimers.set(timerKey, timer);
    }
  } catch (error) {
    console.error("Error in sendReminder:", error);
    // Schedule next reminder despite error to maintain reminder chain
    const prefs = await reminderDb.getPreferences(userId, reminderType);
    if (prefs && prefs.enabled) {
      scheduleNextReminder(userId, prefs);
    }
  }
};

export async function startReminders(
  userId: string,
  reminderType: string,
): Promise<void> {
  const prefs = await reminderDb.getPreferences(userId, reminderType);
  if (prefs && prefs.enabled) {
    await sendReminder(userId, reminderType);
  }
}

export function stopReminders(userId: string, reminderType: string): void {
  const timerKey = getTimerKey(userId, reminderType);
  if (userTimers.has(timerKey)) {
    clearTimeout(userTimers.get(timerKey));
    userTimers.delete(timerKey);
  }
}

export async function scheduleReminders(): Promise<void> {
  for (const [type] of reminderHandlers) {
    const users = await reminderDb.getAllEnabledUsers(type);
    for (const prefs of users) {
      await startReminders(prefs.user_id, type);
    }
  }
}

export async function initializeReminders(): Promise<void> {
  if (!discordClient) {
    throw new Error("Discord client not set");
  }
  await scheduleReminders();
}
