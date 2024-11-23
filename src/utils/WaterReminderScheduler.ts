import { Client, Message } from 'discord.js';
import { waterReminderDb } from './WaterReminderDatabase';
import { WaterReminderPreferences } from '../types/water-reminder';
import { waterDb } from './WaterDatabase';
import spacetime from 'spacetime';

const REMINDER_MESSAGES = [
    "💧 Time for a water break! Stay hydrated!",
    "🚰 Hey there! Remember to drink some water!",
    "💦 Hydration check! Take a moment to drink some water.",
    "🌊 Your body needs water to function at its best. Time for a drink!",
    "💧 Did you know? Staying hydrated helps improve focus and energy. Drink up!",
    "🚰 Quick reminder to take care of yourself - have some water!",
    "💦 Water break time! Your future self will thank you.",
    "🌊 Stay awesome, stay hydrated! Time for some H2O!"
];

const CONGRATULATORY_MESSAGES = [
    "🎉 Great job staying hydrated!",
    "💪 Your body thanks you for that water!",
    "⭐ Keep up the great hydration habits!",
    "🌟 Awesome! Your future self will thank you for staying hydrated!",
    "🎊 That's the spirit! Stay hydrated, stay healthy!"
];

const ENCOURAGEMENT_MESSAGES = [
    "💭 No worries! Remember, staying hydrated helps you feel more energetic!",
    "🌱 Maybe next time! Water is your body's best friend.",
    "💪 You've got this! Try to get some water when you can.",
    "🌟 That's okay! Just remember to drink water when you get the chance.",
    "💧 Take care of yourself! Even small sips throughout the day help."
];

const WATER_AMOUNT_ML = 250; // Assuming one glass of water is about 250ml

class WaterReminderScheduler {
    private static instance: WaterReminderScheduler;
    private userTimers: Map<string, NodeJS.Timeout> = new Map();
    private client: Client | null = null;

    private constructor() {}

    public static getInstance(): WaterReminderScheduler {
        if (!WaterReminderScheduler.instance) {
            WaterReminderScheduler.instance = new WaterReminderScheduler();
        }
        return WaterReminderScheduler.instance;
    }

    public setClient(client: Client) {
        this.client = client;
    }

    private getRandomMessage(): string {
        return REMINDER_MESSAGES[Math.floor(Math.random() * REMINDER_MESSAGES.length)];
    }

    private getRandomInterval(): number {
        // Return a random interval between 30 and 90 minutes (in milliseconds)
        return (Math.floor(Math.random() * 60) + 30) * 60 * 1000;
    }

    private async sendReminder(userId: string): Promise<void> {
        if (!this.client) return;

        try {
            const user = await this.client.users.fetch(userId);
            const prefs = await waterReminderDb.getPreferences(userId);

            if (!prefs || !prefs.enabled) {
                this.stopReminders(userId);
                return;
            }

            const now = spacetime.now(prefs.timezone);

            // Convert start and end times to spacetime objects for proper comparison
            const [startHour, startMinute] = prefs.start_time.split(':').map(Number);
            const [endHour, endMinute] = prefs.end_time.split(':').map(Number);

            const startTime = now.clone().hour(startHour).minute(startMinute);
            const endTime = now.clone().hour(endHour).minute(endMinute);

            // Check if current time is within the reminder window
            if (now.isBetween(startTime, endTime)) {
                console.log(`[DEBUG] Sending water reminder to user ${userId}`);
                const message = await user.send(this.getRandomMessage());
                console.log(`[DEBUG] Message sent with ID: ${message.id}`);

                try {
                    // Add the reaction options to the message first
                    await message.react('👍');
                    await message.react('👎');
                    console.log('[DEBUG] Added initial reactions to message');

                    const filter = (reaction: any, reactUser: any) => {
                        console.log(`[DEBUG] Checking reaction:`, {
                            emoji: reaction.emoji.name,
                            reactUserId: reactUser.id,
                            expectedUserId: userId,
                            isValid: reactUser.id === userId && ['👍', '👎'].includes(reaction.emoji.name)
                        });
                        return reactUser.id === userId && ['👍', '👎'].includes(reaction.emoji.name);
                    };

                    console.log('[DEBUG] Awaiting reactions...');
                    const collected = await message.awaitReactions({
                        filter,
                        max: 1,
                        time: 3600000,
                        errors: ['time']
                    });

                    const reaction = collected.first();
                    console.log('[DEBUG] Reaction collected:', reaction?.emoji.name);

                    if (reaction?.emoji.name === '👍') {
                        // Add water entry and send congratulatory message
                        await waterDb.addEntry(WATER_AMOUNT_ML);
                        console.log(`[DEBUG] Water entry added: ${WATER_AMOUNT_ML}mL`);

                        const congratsMessage = CONGRATULATORY_MESSAGES[Math.floor(Math.random() * CONGRATULATORY_MESSAGES.length)];
                        await user.send(congratsMessage);
                        console.log('[DEBUG] Sent congratulatory message');
                    } else if (reaction?.emoji.name === '👎') {
                        // Send encouragement message
                        const encourageMessage = ENCOURAGEMENT_MESSAGES[Math.floor(Math.random() * ENCOURAGEMENT_MESSAGES.length)];
                        await user.send(encourageMessage);
                        console.log('[DEBUG] Sent encouragement message');
                    }

                } catch (error) {
                    if (error instanceof Error) {
                        console.error('[DEBUG] Error in reaction handling:', error.message);
                    } else {
                        console.error('[DEBUG] Unknown error in reaction handling');
                    }
                }
            }

            // Schedule next reminder
            this.scheduleNextReminder(userId, prefs);
        } catch (error) {
            console.error(`Error sending water reminder to user ${userId}:`, error);
        }
    }

    private scheduleNextReminder(userId: string, prefs: WaterReminderPreferences): void {
        const interval = this.getRandomInterval();
        const timer = setTimeout(() => this.sendReminder(userId), interval);

        // Clear any existing timer before setting a new one
        if (this.userTimers.has(userId)) {
            clearTimeout(this.userTimers.get(userId));
        }

        this.userTimers.set(userId, timer);
    }

    public async startReminders(userId: string): Promise<void> {
        const prefs = await waterReminderDb.getPreferences(userId);
        if (prefs && prefs.enabled) {
            this.scheduleNextReminder(userId, prefs);
        }
    }

    public stopReminders(userId: string): void {
        if (this.userTimers.has(userId)) {
            clearTimeout(this.userTimers.get(userId));
            this.userTimers.delete(userId);
        }
    }

    public async initializeReminders(): Promise<void> {
        const activeUsers = await waterReminderDb.getAllActiveUsers();
        for (const prefs of activeUsers) {
            await this.startReminders(prefs.user_id);
        }
    }
}

export const waterReminderScheduler = WaterReminderScheduler.getInstance();
