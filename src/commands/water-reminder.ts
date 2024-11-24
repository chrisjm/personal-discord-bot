import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import * as waterReminderDb from "../utils/waterReminderDatabase";
import * as waterReminderScheduler from "../utils/waterReminderScheduler";

export const data = new SlashCommandBuilder()
  .setName("water-reminder")
  .setDescription("Manage water drinking reminders")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("start")
      .setDescription("Start receiving water reminders")
      .addStringOption((option) =>
        option
          .setName("start_time")
          .setDescription("Start time for reminders (24h format, e.g., 08:00)")
          .setRequired(false),
      )
      .addStringOption((option) =>
        option
          .setName("end_time")
          .setDescription("End time for reminders (24h format, e.g., 19:00)")
          .setRequired(false),
      )
      .addStringOption((option) =>
        option
          .setName("timezone")
          .setDescription("Your timezone (e.g., America/Los_Angeles)")
          .setRequired(false),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("stop").setDescription("Stop receiving water reminders"),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  const userId = interaction.user.id;

  if (subcommand === "start") {
    const startTime = interaction.options.getString("start_time") || "08:00";
    const endTime = interaction.options.getString("end_time") || "19:00";
    const timezone =
      interaction.options.getString("timezone") || "America/Los_Angeles";

    // Validate time format
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      await interaction.reply({
        content: "Please provide times in 24-hour format (HH:mm), e.g., 08:00",
        ephemeral: true,
      });
      return;
    }

    try {
      await waterReminderDb.setPreferences({
        user_id: userId,
        enabled: true,
        start_time: startTime,
        end_time: endTime,
        timezone: timezone,
      });

      await waterReminderScheduler.startReminders(userId);

      await interaction.reply({
        content:
          `✅ Water reminders enabled! You'll receive reminders between ${startTime} and ${endTime} ${timezone}.\n` +
          "I'll send you friendly reminders to stay hydrated throughout the day!",
        ephemeral: true,
      });
    } catch (error) {
      console.error("Error starting water reminders:", error);
      await interaction.reply({
        content:
          "There was an error setting up your water reminders. Please try again.",
        ephemeral: true,
      });
    }
  } else if (subcommand === "stop") {
    try {
      const prefs = await waterReminderDb.getPreferences(userId);
      if (prefs) {
        await waterReminderDb.setPreferences({
          ...prefs,
          enabled: false,
        });
      }

      waterReminderScheduler.stopReminders(userId);

      await interaction.reply({
        content: "✅ Water reminders have been disabled. Stay hydrated!",
        ephemeral: true,
      });
    } catch (error) {
      console.error("Error stopping water reminders:", error);
      await interaction.reply({
        content:
          "There was an error stopping your water reminders. Please try again.",
        ephemeral: true,
      });
    }
  }
}
