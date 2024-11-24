import { Client } from "discord.js";

export interface ReminderPreferences {
  user_id: string;
  enabled: boolean;
  start_time: string;
  end_time: string;
  timezone: string;
  reminder_type: string;
  frequency_minutes?: number;
  custom_messages?: string[];
}

export interface ReminderDatabaseRow {
  user_id: string;
  enabled: number;
  start_time: string;
  end_time: string;
  timezone: string;
  reminder_type: string;
  frequency_minutes: number | null;
  custom_messages: string | null;
}

export interface ReminderHandler {
  type: string;
  defaultMessages: string[];
  defaultFrequencyMinutes: number;
  onReminder: (client: Client, userId: string) => Promise<void>;
}
