import { logger } from './logger';
import { 
  ChatInputCommandInteraction, 
  InteractionReplyOptions, 
  MessageCreateOptions 
} from 'discord.js';

/**
 * Comprehensive error handling utility for Discord bot
 */
export class ErrorHandler {
  /**
   * Handle and log errors that occur during command execution
   * @param error - The error that occurred
   * @param interaction - Optional interaction for replying with error message
   */
  static async handleCommandError(
    error: Error, 
    interaction?: ChatInputCommandInteraction
  ): Promise<void> {
    // Log the full error for debugging
    logger.error('Command execution error', { 
      errorName: error.name, 
      errorMessage: error.message,
      stack: error.stack 
    });

    // If interaction is available, send an error response to the user
    if (interaction && interaction.isRepliable()) {
      const errorReply: InteractionReplyOptions = {
        content: '❌ An unexpected error occurred while processing your command.',
        ephemeral: true
      };

      try {
        await interaction.reply(errorReply);
      } catch (replyError) {
        logger.error('Failed to send error reply', replyError);
      }
    }
  }

  /**
   * Handle network-related errors
   * @param error - Network error
   * @param context - Additional context about the network operation
   */
  static handleNetworkError(error: Error, context?: any): void {
    logger.error('Network error occurred', { 
      errorName: error.name,
      errorMessage: error.message,
      context 
    });
  }

  /**
   * Handle database-related errors
   * @param error - Database error
   * @param context - Additional context about the database operation
   */
  static handleDatabaseError(error: Error, context?: any): void {
    logger.error('Database error occurred', { 
      errorName: error.name,
      errorMessage: error.message,
      context 
    });
  }

  /**
   * Create a user-friendly error message
   * @param error - Original error
   * @returns Formatted error message
   */
  static formatErrorMessage(error: Error): string {
    const defaultMessage = 'An unexpected error occurred';
    
    // Map of known error types to user-friendly messages
    const errorMap: { [key: string]: string } = {
      'ValidationError': 'Invalid input provided',
      'NetworkError': 'Unable to connect to the service',
      'DatabaseError': 'Database operation failed',
      'PermissionError': 'You do not have permission to do this'
    };

    return errorMap[error.name] || defaultMessage;
  }

  /**
   * Safely execute a function with error handling
   * @param fn - Function to execute
   * @param errorHandler - Optional custom error handler
   */
  static async safeExecute<T>(
    fn: () => Promise<T>, 
    errorHandler?: (error: Error) => void
  ): Promise<T | null> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof Error) {
        if (errorHandler) {
          errorHandler(error);
        } else {
          logger.error('Unhandled error in safeExecute', error);
        }
      }
      return null;
    }
  }
}

/**
 * Custom error classes for more specific error handling
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}
