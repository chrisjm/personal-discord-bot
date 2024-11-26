import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import * as reminderDb from "../utils/reminderDatabase";
import * as reminderScheduler from "../utils/reminderScheduler";

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
      )
      .addIntegerOption((option) =>
        option
          .setName("frequency")
          .setDescription("Reminder frequency in minutes (default: 45)")
          .setRequired(false),
      )
      .addBooleanOption((option) =>
        option
          .setName("random")
          .setDescription(
            "Enable random timing between frequency and frequency*multiple (default: true)",
          )
          .setRequired(false),
      )
      .addNumberOption((option) =>
        option
          .setName("random_multiple")
          .setDescription("Maximum random frequency multiplier (default: 1.5)")
          .setMinValue(1.0)
          .setMaxValue(3.0)
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
    const frequency = interaction.options.getInteger("frequency") || 60;

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
      const prefs = {
        user_id: userId,
        reminder_type: "water",
        enabled: true,
        start_time: startTime,
        end_time: endTime,
        timezone: timezone,
        frequency_minutes: frequency,
        random: interaction.options.getBoolean("random") ?? true,
        frequency_random_multiple:
          interaction.options.getNumber("random_multiple") ?? 1.5,
      };

      await reminderDb.setPreferences(prefs);
      
      // Send immediate reminder and start the chain
      await reminderScheduler.startReminders(userId, "water");

      await interaction.reply({
        content:
          `✅ Water reminders enabled! You'll receive reminders between ${startTime} and ${endTime} ${timezone}\n` +
          `Frequency: ${frequency} minutes` +
          ((interaction.options.getBoolean("random") ?? true)
            ? ` (randomly between ${Math.floor(frequency)} and ${Math.floor(frequency * (interaction.options.getNumber("random_multiple") ?? 1.5))} minutes)`
            : "") +
          `\nYour first reminder will be sent shortly!`,
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
      const prefs = await reminderDb.getPreferences(userId, "water");
      if (prefs) {
        await reminderDb.setPreferences({
          ...prefs,
          enabled: false,
        });
      }

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
