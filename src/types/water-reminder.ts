export interface WaterReminderDatabaseRow {
    user_id: string;
    enabled: number;
    start_time: string;
    end_time: string;
    timezone: string;
}

export interface WaterReminderPreferences {
    user_id: string;
    enabled: boolean;
    start_time: string;
    end_time: string;
    timezone: string;
}
