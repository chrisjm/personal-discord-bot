import { Client } from "discord.js";

export interface ReminderPreferences {
  user_id: string;
  enabled: boolean;
  start_time: string;
  end_time: string;
  timezone: string;
  reminder_type: string;
  frequency_minutes: number;
  random: boolean;
  frequency_random_multiple: number;
}

export interface ReminderDatabaseRow {
  user_id: string;
  enabled: number;
  start_time: string;
  end_time: string;
  timezone: string;
  reminder_type: string;
  frequency_minutes: number;
  random: number;
  frequency_random_multiple: number;
}

export interface ReminderHandler {
  type: string;
  defaultMessages: string[];
  defaultFrequencyMinutes: number;
  defaultRandom: boolean;
  defaultFrequencyRandomMultiple: number;
  onReminder: (client: Client, userId: string) => Promise<void>;
}
