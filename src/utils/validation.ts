import { logger } from "./logger";

/**
 * Validation utility class for input and data validation
 */
export class Validator {
  /**
   * Validate email address
   * @param email - Email address to validate
   * @returns Boolean indicating if email is valid
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate Discord user ID
   * @param userId - Discord user ID to validate
   * @returns Boolean indicating if user ID is valid
   */
  static isValidDiscordUserId(userId: string): boolean {
    const userIdRegex = /^\d{17,19}$/;
    return userIdRegex.test(userId);
  }

  /**
   * Validate and sanitize input string
   * @param input - Input string to validate
   * @param maxLength - Maximum allowed length
   * @returns Sanitized string or null if invalid
   */
  static sanitizeString(input: string, maxLength: number = 100): string | null {
    if (!input) return null;

    // Trim whitespace and remove potentially harmful characters
    const sanitized = input.trim().replace(/[<>]/g, "");

    if (sanitized.length > maxLength) {
      logger.warn(`Input exceeds maximum length of ${maxLength}`);
      return sanitized.slice(0, maxLength);
    }

    return sanitized;
  }

  /**
   * Check if a value is within a specified range
   * @param value - Number to check
   * @param min - Minimum allowed value
   * @param max - Maximum allowed value
   * @returns Boolean indicating if value is in range
   */
  static isInRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
  }

  /**
   * Validate URL
   * @param url - URL to validate
   * @returns Boolean indicating if URL is valid
   */
  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Custom error class for validation errors
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
