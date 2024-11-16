import { Client, Collection } from 'discord.js';
import { BotCommand } from './interfaces';

/**
 * Extended Discord Client with additional properties for bot functionality
 */
declare module 'discord.js' {
  interface Client {
    /**
     * Collection of bot commands for easy access and management
     */
    commands?: Collection<string, BotCommand>;
    
    /**
     * Cooldowns for commands to prevent spam
     */
    cooldowns?: Collection<string, Collection<string, number>>;
  }
}

/**
 * Environment configuration interface
 * Defines the shape of environment variables
 */
export interface EnvironmentConfig {
  /**
   * Discord bot token for authentication
   */
  DISCORD_TOKEN: string;
  
  /**
   * Client ID of the Discord application
   */
  CLIENT_ID: string;
  
  /**
   * Guild ID for guild-specific commands (optional)
   */
  GUILD_ID?: string;
  
  /**
   * Database connection string
   */
  DATABASE_URL: string;
}

/**
 * Utility type for making certain properties optional
 */
export type Partial<T> = {
  [P in keyof T]?: T[P];
}

/**
 * Logging levels for consistent logging across the application
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}
