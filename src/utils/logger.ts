import { LogLevel } from "../types/global";
// Using dynamic import for chalk
let chalkInstance: any;
(async () => {
  chalkInstance = (await import("chalk")).default;
})();

/**
 * Advanced logging utility for the Discord bot
 * Provides colorful, contextual logging with different log levels
 */
export class Logger {
  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {}

  /**
   * Singleton instance of the Logger
   */
  private static instance: Logger;

  /**
   * Get the singleton instance of the Logger
   * @returns Logger instance
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Log an error message
   * @param message - The error message to log
   * @param context - Optional context for the error
   */
  error(message: string, context?: any): void {
    this.log(LogLevel.ERROR, chalkInstance.red(message), context);
  }

  /**
   * Log a warning message
   * @param message - The warning message to log
   * @param context - Optional context for the warning
   */
  warn(message: string, context?: any): void {
    this.log(LogLevel.WARN, chalkInstance.yellow(message), context);
  }

  /**
   * Log an informational message
   * @param message - The info message to log
   * @param context - Optional context for the info
   */
  info(message: string, context?: any): void {
    this.log(LogLevel.INFO, chalkInstance.blue(message), context);
  }

  /**
   * Log a debug message
   * @param message - The debug message to log
   * @param context - Optional context for debugging
   */
  debug(message: string, context?: any): void {
    this.log(LogLevel.DEBUG, chalkInstance.gray(message), context);
  }

  /**
   * Internal method to handle logging with different levels
   * @param level - The log level
   * @param message - The formatted message
   * @param context - Optional additional context
   */
  private log(level: LogLevel, message: string, context?: any): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    console.log(logMessage);

    if (context) {
      console.dir(context, { depth: null });
    }
  }
}

/**
 * Export a pre-configured logger instance
 */
export const logger = Logger.getInstance();
