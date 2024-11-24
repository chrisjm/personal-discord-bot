import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

/**
 * Interface representing a Discord bot command
 * Ensures consistent structure for all bot commands
 */
export interface BotCommand {
  /**
   * Slash command data for Discord's command registration
   */
  data:
    | SlashCommandBuilder
    | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;

  /**
   * Execute method for the command
   * @param interaction - The interaction that triggered the command
   */
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

/**
 * Type guard to check if a command implements the BotCommand interface
 * @param command - The command to check
 * @returns Boolean indicating if the command is a valid BotCommand
 */
export function isBotCommand(command: any): command is BotCommand {
  return (
    command &&
    typeof command.data === "object" &&
    typeof command.execute === "function"
  );
}

/**
 * Enum for common command categories
 * Helps in organizing and categorizing bot commands
 */
export enum CommandCategory {
  UTILITY = "Utility",
  MODERATION = "Moderation",
  FUN = "Fun",
  TRACKING = "Tracking",
  INFORMATION = "Information",
}
