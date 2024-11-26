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

const getRandomInterval = (minMinutes: number, maxMinutes: number): number => {
  const min = minMinutes;
  const max = maxMinutes;
  return Math.floor(Math.random() * (max - min + 1) + min) * 60 * 1000;
};

const scheduleNextReminder = (
  userId: string,
  prefs: ReminderPreferences,
): void => {
  console.log(`[DEBUG] Scheduling next reminder for user ${userId}, type: ${prefs.reminder_type}`);
  
  const handler = reminderHandlers.get(prefs.reminder_type);
  if (!handler) {
    console.error(`No handler found for reminder type: ${prefs.reminder_type}`);
    return;
  }

  const interval = getRandomInterval(
    prefs.frequency_minutes,
    prefs.frequency_minutes * (prefs.frequency_random_multiple ?? 1.0),
  );
  console.log(`[DEBUG] Calculated interval: ${interval}ms (${interval / (60 * 1000)} minutes)`);

  const timerKey = getTimerKey(userId, prefs.reminder_type);
  const timer = setTimeout(
    () => sendReminder(userId, prefs.reminder_type),
    interval,
  );

  // Clear any existing timer before setting a new one
  if (userTimers.has(timerKey)) {
    console.log(`[DEBUG] Clearing existing timer for ${timerKey}`);
    clearTimeout(userTimers.get(timerKey));
  }

  userTimers.set(timerKey, timer);
  console.log(`[DEBUG] Set new timer for ${timerKey}, next reminder in ${interval / (60 * 1000)} minutes`);
};

const sendReminder = async (
  userId: string,
  reminderType: string,
): Promise<void> => {
  console.log(`[DEBUG] Attempting to send reminder for user ${userId}, type: ${reminderType}`);
  if (!discordClient) {
    console.log(`[DEBUG] Discord client not initialized, skipping reminder`);
    return;
  }

  try {
    const spacetime = (await spacetimeImport).default;
    const prefs = await reminderDb.getPreferences(userId, reminderType);
    console.log(`[DEBUG] Loaded preferences:`, JSON.stringify(prefs, null, 2));
    
    const handler = reminderHandlers.get(reminderType);

    if (!prefs || !prefs.enabled || !handler) {
      console.log(`[DEBUG] Stopping reminders - prefs enabled: ${prefs?.enabled}, handler exists: ${!!handler}`);
      stopReminders(userId, reminderType);
      return;
    }

    const now = spacetime.now(prefs.timezone);
    const currentTime = now.epoch;
    console.log(`[DEBUG] Current time in ${prefs.timezone}: ${now.format('nice')}`);

    // Check if enough time has passed since the last reminder
    if (prefs.last_sent) {
      const timeSinceLastReminder = currentTime - prefs.last_sent;
      const minInterval = prefs.frequency_minutes * 60 * 1000;
      console.log(`[DEBUG] Time since last reminder: ${timeSinceLastReminder / (60 * 1000)} minutes`);
      console.log(`[DEBUG] Minimum interval: ${minInterval / (60 * 1000)} minutes`);
      
      if (timeSinceLastReminder < minInterval) {
        const remainingTime = minInterval - timeSinceLastReminder;
        console.log(`[DEBUG] Not enough time passed, scheduling for remaining time: ${remainingTime / (60 * 1000)} minutes`);
        scheduleNextReminder(userId, prefs);
        return;
      }
    }

    // Convert start and end times to spacetime objects for proper comparison
    const [startHour, startMinute] = prefs.start_time.split(":").map(Number);
    const [endHour, endMinute] = prefs.end_time.split(":").map(Number);

    const startTime = now.clone().hour(startHour).minute(startMinute);
    const endTime = now.clone().hour(endHour).minute(endMinute);

    console.log(`[DEBUG] Reminder window: ${startTime.format('time')} to ${endTime.format('time')}`);
    console.log(`[DEBUG] Current time: ${now.format('time')}`);

    // Check if current time is within the reminder window
    if (now.isBetween(startTime, endTime)) {
      console.log(`[DEBUG] Current time is within reminder window, executing handler`);
      try {
        console.log(`[DEBUG] Calling handler.onReminder for type: ${reminderType}`);
        await handler.onReminder(discordClient, userId);
        console.log(`[DEBUG] Handler executed successfully`);

        console.log(`[DEBUG] Updating last_sent timestamp to ${currentTime}`);
        await reminderDb.updateLastSent(userId, reminderType, currentTime);
        console.log(`[DEBUG] Last sent timestamp updated successfully`);

        console.log(`[DEBUG] Reminder sent successfully, scheduling next reminder`);
        scheduleNextReminder(userId, prefs);
      } catch (innerError) {
        console.error(`[ERROR] Failed during reminder execution:`, innerError);
        // Still try to schedule the next reminder despite the error
        console.log(`[DEBUG] Attempting to schedule next reminder despite execution error`);
        scheduleNextReminder(userId, prefs);
      }
    } else {
      // If outside reminder window, calculate time until next window
      const nextStart = now.isBefore(startTime)
        ? startTime
        : startTime.add(1, "day");
      const msUntilStart = nextStart.epoch - now.epoch;
      
      console.log(`[DEBUG] Outside reminder window. Next start time: ${nextStart.format('nice')}`);
      console.log(`[DEBUG] Time until next start: ${msUntilStart / (60 * 1000)} minutes`);

      const timerKey = getTimerKey(userId, reminderType);
      const timer = setTimeout(() => {
        scheduleNextReminder(userId, prefs);
      }, msUntilStart);

      if (userTimers.has(timerKey)) {
        console.log(`[DEBUG] Clearing existing timer for ${timerKey}`);
        clearTimeout(userTimers.get(timerKey));
      }
      userTimers.set(timerKey, timer);
    }
  } catch (error) {
    console.error("Error in sendReminder:", error);
    // Schedule next reminder despite error to maintain reminder chain
    const prefs = await reminderDb.getPreferences(userId, reminderType);
    if (prefs && prefs.enabled) {
      console.log(`[DEBUG] Scheduling next reminder despite error`);
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
