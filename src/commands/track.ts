import * as dotenv from "dotenv";
dotenv.config();

import spacetime from "spacetime";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Interaction,
  SlashCommandBuilder,
} from "discord.js";
import { waterDb } from "../utils/database";

const CODE_START = "```\n";
const CODE_END = "```\n";
const USER_TIMEZONE = "America/Los_Angeles"; // This could be made configurable per user in the future

export const data = new SlashCommandBuilder()
  .setName("track-water")
  .setDescription("Track water intake")
  .addStringOption((option) =>
    option
      .setName("action")
      .setDescription("What would you like to do?")
      .setRequired(true)
      .addChoices(
        { name: "add", value: "add" },
        { name: "today", value: "today" },
        { name: "range", value: "range" }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (interaction.options.getString("action") === "add") {
    const addHalfLiter = new ButtonBuilder()
      .setCustomId("500-ml")
      .setLabel("500mL")
      .setStyle(ButtonStyle.Primary);

    const addLiter = new ButtonBuilder()
      .setCustomId("1000-ml")
      .setLabel("1L")
      .setStyle(ButtonStyle.Secondary);

    const cancel = new ButtonBuilder()
      .setCustomId("cancel")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      addHalfLiter,
      addLiter,
      cancel
    );

    const response = await interaction.reply({
      content: `How much water would you like to add?`,
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
        const milliliters = parseInt(confirmation.customId.split("-")[0]);

        try {
          const message = await waterDb.addEntry(milliliters);
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
  } else if (interaction.options.getString("action") === "today") {
    const now = spacetime.now(USER_TIMEZONE);
    try {
      // Convert local day boundaries to UTC for database query
      const startOfDay = now.startOf('day');
      const endOfDay = now.endOf('day');
      const startDate = startOfDay.goto('UTC').format('iso');
      const endDate = endOfDay.goto('UTC').format('iso');

      const entries = await waterDb.getEntriesInRange(startDate, endDate);

      if (!entries || entries.length === 0) {
        await interaction.reply({
          content: "No water entries found for today.",
        });
        return;
      }

      const formattedEntries = entries.map((entry) => {
        // Convert UTC database time to user's timezone for display
        const datetime = spacetime(entry.entry_datetime).goto(USER_TIMEZONE);
        return `${datetime.format("nice")} - ${entry.milliliters}mL`;
      });

      const totalMl = entries.reduce((acc, curr) => acc + curr.milliliters, 0);
      await interaction.reply({
        content: `${CODE_START}${formattedEntries.join(
          "\n"
        )}\nToday's total water intake: ${totalMl}mL\n${CODE_END}`,
      });
    } catch (e) {
      console.error(e);
      await interaction.reply({ content: `Error! ${e}` });
    }
  } else if (interaction.options.getString("action") === "range") {
    const now = spacetime.now(USER_TIMEZONE);

    const yesterday = new ButtonBuilder()
      .setCustomId("minus-1")
      .setLabel("Yesterday")
      .setStyle(ButtonStyle.Primary);

    const minusTwoDays = new ButtonBuilder()
      .setCustomId("minus-2")
      .setLabel("-2 Days")
      .setStyle(ButtonStyle.Primary);

    const minusThreeDays = new ButtonBuilder()
      .setCustomId("minus-3")
      .setLabel("-3 Days")
      .setStyle(ButtonStyle.Primary);

    const minusFourDays = new ButtonBuilder()
      .setCustomId("minus-4")
      .setLabel("-4 Days")
      .setStyle(ButtonStyle.Primary);

    const cancel = new ButtonBuilder()
      .setCustomId("cancel")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      yesterday,
      minusTwoDays,
      minusThreeDays,
      minusFourDays,
      cancel
    );

    const response = await interaction.reply({
      content: `How far back in history?`,
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
        const days = parseInt(confirmation.customId.split("-")[1]);
        const rangeDate = now.subtract(days, "day");

        try {
          // Convert local day boundaries to UTC for database query
          const startOfDay = rangeDate.startOf('day');
          const endOfDay = rangeDate.endOf('day');
          const startDate = startOfDay.goto('UTC').format('iso');
          const endDate = endOfDay.goto('UTC').format('iso');

          const entries = await waterDb.getEntriesInRange(startDate, endDate);

          if (!entries || entries.length === 0) {
            await confirmation.update({
              content: `No water entries found for ${days} day${days > 1 ? 's' : ''} ago.`,
              components: [],
            });
            return;
          }

          const formattedEntries = entries.map((entry) => {
            // Convert UTC database time to user's timezone for display
            const datetime = spacetime(entry.entry_datetime).goto(USER_TIMEZONE);
            return `${datetime.format("nice")} - ${entry.milliliters}mL`;
          });

          const totalMl = entries.reduce((acc, curr) => acc + curr.milliliters, 0);
          await confirmation.update({
            content: `${CODE_START}${formattedEntries.join(
              "\n"
            )}\nTotal water intake: ${totalMl}mL\n${CODE_END}`,
            components: [],
          });
        } catch (e) {
          console.error(e);
          await confirmation.update({
            content: `Error fetching entries: ${e}`,
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
}
