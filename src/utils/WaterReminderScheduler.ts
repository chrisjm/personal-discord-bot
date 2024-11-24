import { Client } from "discord.js";
import * as waterReminderDb from "./waterReminderDatabase";
import { WaterReminderPreferences } from "../types/water-reminder";
import * as waterDb from "./waterTrackerDatabase";

const spacetimeImport = import("spacetime");
const REMINDER_MESSAGES = [
    "💧 Time for a water break! Stay hydrated!",
    "🚰 Hey there! Remember to drink some water!",
    "💦 Hydration check! Take a moment to drink some water.",
    "🌊 Your body needs water to function at its best. Time for a drink!",
    "💧 Did you know? Staying hydrated helps improve focus and energy. Drink up!",
    "🚰 Quick reminder to take care of yourself - have some water!",
    "💦 Water break time! Your future self will thank you.",
    "🌊 Stay awesome, stay hydrated! Time for some H2O!",
];

const CONGRATULATORY_MESSAGES = [
    "🎉 Great job staying hydrated!",
    "💪 Your body thanks you for that water!",
    "⭐ Keep up the great hydration habits!",
    "🌟 Awesome! Your future self will thank you for staying hydrated!",
    "🎊 That's the spirit! Stay hydrated, stay healthy!",
];

const ENCOURAGEMENT_MESSAGES = [
    "💭 No worries! Remember, staying hydrated helps you feel more energetic!",
    "🌱 Maybe next time! Water is your body's best friend.",
    "💪 You've got this! Try to get some water when you can.",
    "🌟 That's okay! Just remember to drink water when you get the chance.",
    "💧 Take care of yourself! Even small sips throughout the day help.",
];

const WATER_AMOUNT_ML = 250; // Assuming one glass of water is about 250ml

// State management
let discordClient: Client | null = null;
const userTimers: Map<string, NodeJS.Timeout> = new Map();

// Helper functions
const getRandomMessage = (): string =>
    REMINDER_MESSAGES[Math.floor(Math.random() * REMINDER_MESSAGES.length)];

const getRandomInterval = (): number =>
    (Math.floor(Math.random() * 60) + 30) * 60 * 1000;

const getRandomFromArray = (arr: string[]): string =>
    arr[Math.floor(Math.random() * arr.length)];

// Core functionality
export const setClient = (client: Client): void => {
    discordClient = client;
};

const scheduleNextReminder = (
    userId: string,
    prefs: WaterReminderPreferences,
): void => {
    const interval = getRandomInterval();
    const timer = setTimeout(() => sendReminder(userId), interval);

    // Clear any existing timer before setting a new one
    if (userTimers.has(userId)) {
        clearTimeout(userTimers.get(userId));
    }

    userTimers.set(userId, timer);
};

const sendReminder = async (userId: string): Promise<void> => {
    if (!discordClient) return;

    try {
        const spacetime = (await spacetimeImport).default;
        const user = await discordClient.users.fetch(userId);
        const prefs = await waterReminderDb.getPreferences(userId);

        if (!prefs || !prefs.enabled) {
            stopReminders(userId);
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
            console.log(`[DEBUG] Sending water reminder to user ${userId}`);
            const message = await user.send(getRandomMessage());

            try {
                // Add the reaction options to the message first
                await message.react("👍");
                await message.react("👎");

                const filter = (reaction: any, reactUser: any) => {
                    return (
                        reactUser.id === userId &&
                        ["👍", "👎"].includes(reaction.emoji.name)
                    );
                };

                const collected = await message.awaitReactions({
                    filter,
                    max: 1,
                    time: 3600000,
                    errors: ["time"],
                });

                const reaction = collected.first();
                console.log("[DEBUG] Reaction collected:", reaction?.emoji.name);

                if (reaction?.emoji.name === "👍") {
                    // Add water entry and send congratulatory message
                    await waterDb.addEntry(WATER_AMOUNT_ML);
                    console.log(`[DEBUG] Water entry added: ${WATER_AMOUNT_ML}mL`);
                    await user.send(getRandomFromArray(CONGRATULATORY_MESSAGES));
                } else if (reaction?.emoji.name === "👎") {
                    // Send encouragement message
                    await user.send(getRandomFromArray(ENCOURAGEMENT_MESSAGES));
                }
            } catch (error) {
                if (error instanceof Error) {
                    console.error("[DEBUG] Error in reaction handling:", error.message);
                } else {
                    console.error("[DEBUG] Unknown error in reaction handling");
                }
            }
        }

        // Schedule next reminder
        scheduleNextReminder(userId, prefs);
    } catch (error) {
        console.error(`Error sending water reminder to user ${userId}:`, error);
    }
};

export const startReminders = async (userId: string): Promise<void> => {
    const prefs = await waterReminderDb.getPreferences(userId);
    if (prefs && prefs.enabled) {
        scheduleNextReminder(userId, prefs);
    }
};

export const stopReminders = (userId: string): void => {
    if (userTimers.has(userId)) {
        clearTimeout(userTimers.get(userId));
        userTimers.delete(userId);
    }
};

export const scheduleReminders = async (): Promise<void> => {
    // Clear existing timers
    for (const timer of userTimers.values()) {
        clearTimeout(timer);
    }
    userTimers.clear();

    // Get all active users and schedule their reminders
    const activeUsers = await waterReminderDb.getAllEnabledUsers();
    for (const user of activeUsers) {
        await startReminders(user.user_id);
    }
};

export const initializeReminders = async (): Promise<void> => {
    const activeUsers = await waterReminderDb.getAllEnabledUsers();
    for (const user of activeUsers) {
        await startReminders(user.user_id);
    }
};
