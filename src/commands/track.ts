import * as dotenv from "dotenv";
dotenv.config();

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Interaction,
  SlashCommandBuilder,
} from "discord.js";
import * as trackingDb from "../utils/trackingDatabase";

const spacetimeImport = import("spacetime");
const CODE_START = "```\n";
const CODE_END = "```\n";
const USER_TIMEZONE = "America/Los_Angeles"; // This could be made configurable per user in the future

// Define common tracking types and their default units
const TRACKING_TYPES = {
  water: { defaultUnit: "ml", description: "Track water intake" },
  mood: { defaultUnit: "score", description: "Track mood (1-10)" },
} as const;

type TrackingType = keyof typeof TRACKING_TYPES;

export const data = new SlashCommandBuilder()
  .setName("track")
  .setDescription("Track various metrics")
  .addStringOption((option) =>
    option
      .setName("action")
      .setDescription("What would you like to do?")
      .setRequired(true)
      .addChoices(
        { name: "add", value: "add" },
        { name: "today", value: "today" },
        { name: "range", value: "range" },
      ),
  )
  .addStringOption((option) => {
    option
      .setName("type")
      .setDescription("What type of metric to track")
      .setRequired(true);

    Object.entries(TRACKING_TYPES).forEach(([type, config]) => {
      option.addChoices({ name: type, value: type });
    });

    return option;
  })
  .addNumberOption((option) =>
    option
      .setName("amount")
      .setDescription("Amount to track")
      .setRequired(false),
  )
  .addStringOption((option) =>
    option
      .setName("unit")
      .setDescription(
        "Unit of measurement (optional, will use default if not specified)",
      )
      .setRequired(false),
  )
  .addStringOption((option) =>
    option
      .setName("note")
      .setDescription("Additional notes about this entry")
      .setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const action = interaction.options.getString("action", true);
  const type = interaction.options.getString("type", true) as TrackingType;

  if (action === "add") {
    const amount = interaction.options.getNumber("amount");
    const unit =
      interaction.options.getString("unit") || TRACKING_TYPES[type].defaultUnit;
    const note = interaction.options.getString("note") || undefined;

    if (amount !== null) {
      // Direct amount provided
      try {
        const message = await trackingDb.addEntry(type, amount, unit, note);
        await interaction.reply(message);
      } catch (e) {
        console.error(e);
        await interaction.reply({
          content: `Error adding entry: ${e}`,
          ephemeral: true,
        });
      }
    } else {
      // No amount provided, show quick-add buttons
      const smallAmount = new ButtonBuilder()
        .setCustomId(`track-${type}-small`)
        .setLabel(`Small ${unit}`)
        .setStyle(ButtonStyle.Primary);

      const mediumAmount = new ButtonBuilder()
        .setCustomId(`track-${type}-medium`)
        .setLabel(`Medium ${unit}`)
        .setStyle(ButtonStyle.Primary);

      const largeAmount = new ButtonBuilder()
        .setCustomId(`track-${type}-large`)
        .setLabel(`Large ${unit}`)
        .setStyle(ButtonStyle.Primary);

      const cancel = new ButtonBuilder()
        .setCustomId("cancel")
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        smallAmount,
        mediumAmount,
        largeAmount,
        cancel,
      );

      const response = await interaction.reply({
        content: `How much ${type} would you like to add?`,
        components: [row],
      });

      // Security - Ensure same user clicked the button as the original interaction
      const collectorFilter = (i: Interaction) =>
        i.user.id === interaction.user.id;

      try {
        const confirmation = await response.awaitMessageComponent({
          filter: collectorFilter,
          time: 30_000,
        });

        if (confirmation.customId === "cancel") {
          await confirmation.update({
            content: "Action cancelled",
            components: [],
          });
        } else {
          const [_, trackType, size] = confirmation.customId.split("-");
          let trackAmount: number;

          // Define amounts for each type and size
          switch (trackType) {
            case "water":
              trackAmount =
                size === "small" ? 250 : size === "medium" ? 500 : 1000;
              break;
            case "mood":
              trackAmount = size === "small" ? 3 : size === "medium" ? 6 : 9;
              break;
            default:
              trackAmount = size === "small" ? 1 : size === "medium" ? 2 : 3;
          }

          try {
            const message = await trackingDb.addEntry(
              trackType as TrackingType,
              trackAmount,
              TRACKING_TYPES[trackType as TrackingType].defaultUnit,
            );
            await confirmation.update({
              content: message,
              components: [],
            });
          } catch (e) {
            console.error(e);
            await confirmation.update({
              content: `Error adding entry: ${e}`,
              components: [],
            });
          }
        }
      } catch (e) {
        console.error(e);
        await interaction.editReply({
          content: `Error! ${e}`,
          components: [],
        });
      }
    }
  } else if (action === "today") {
    try {
      const spacetime = (await spacetimeImport).default;
      const now = spacetime.now(USER_TIMEZONE);
      const startOfDay = now.startOf("day").toNativeDate().toISOString();
      const endOfDay = now.endOf("day").toNativeDate().toISOString();

      const entries = await trackingDb.getEntriesInRange(
        type,
        startOfDay,
        endOfDay,
      );

      if (entries.length === 0) {
        await interaction.reply(`No ${type} entries found for today.`);
        return;
      }

      let total = entries.reduce((sum, entry) => sum + entry.amount, 0);
      const unit = entries[0].unit; // Assume consistent units for the same type

      let response = `${CODE_START}Today's ${type} entries:\n`;
      entries.forEach((entry) => {
        const time = new Date(entry.entry_datetime).toLocaleTimeString(
          "en-US",
          {
            timeZone: USER_TIMEZONE,
            hour: "numeric",
            minute: "numeric",
          },
        );
        response += `${time}: ${entry.amount}${entry.unit}${entry.note ? ` (${entry.note})` : ""}\n`;
      });
      response += `\nTotal: ${total}${unit}${CODE_END}`;

      await interaction.reply(response);
    } catch (e) {
      console.error(e);
      await interaction.reply({
        content: `Error fetching today's entries: ${e}`,
        ephemeral: true,
      });
    }
  } else if (action === "range") {
    try {
      const spacetime = (await spacetimeImport).default;
      const now = spacetime.now(USER_TIMEZONE);
      const startOfWeek = now.startOf("week").toNativeDate().toISOString();
      const endOfWeek = now.endOf("week").toNativeDate().toISOString();

      const entries = await trackingDb.getEntriesInRange(
        type,
        startOfWeek,
        endOfWeek,
      );

      if (entries.length === 0) {
        await interaction.reply(`No ${type} entries found for this week.`);
        return;
      }

      let total = entries.reduce((sum, entry) => sum + entry.amount, 0);
      const unit = entries[0].unit; // Assume consistent units for the same type

      let response = `${CODE_START}This week's ${type} entries:\n`;
      entries.forEach((entry) => {
        const date = new Date(entry.entry_datetime).toLocaleDateString(
          "en-US",
          {
            timeZone: USER_TIMEZONE,
            weekday: "short",
            month: "short",
            day: "numeric",
          },
        );
        response += `${date}: ${entry.amount}${entry.unit}${entry.note ? ` (${entry.note})` : ""}\n`;
      });
      response += `\nTotal: ${total}${unit}${CODE_END}`;

      await interaction.reply(response);
    } catch (e) {
      console.error(e);
      await interaction.reply({
        content: `Error fetching range entries: ${e}`,
        ephemeral: true,
      });
    }
  }
}
