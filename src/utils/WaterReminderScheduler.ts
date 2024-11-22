import { Client } from 'discord.js';
import { waterReminderDb, WaterReminderPreferences } from './WaterReminderDatabase';
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
            const currentTime = now.format('HH:mm');
            
            // Check if current time is within the reminder window
            if (currentTime >= prefs.start_time && currentTime <= prefs.end_time) {
                await user.send(this.getRandomMessage());
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
