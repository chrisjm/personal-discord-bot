import * as dotenv from "dotenv";
dotenv.config();

import axios from "axios";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Interaction,
  SlashCommandBuilder,
} from "discord.js";

const apiUrl = process.env.WATER_TRACKER_API_URL;
const CODE_START = "```\n";
const CODE_END = "```\n";

interface WaterTrackerEntry {
  id: { S: string };
  entry_datetime: { S: string };
  milliliters: { N: string };
}

function getDateOffsetUTCString(offset = 0) {
  let datetime = new Date();
  datetime.setDate(datetime.getDate() + offset);

  let dateUTC = new Date(datetime.toUTCString());
  // Set the start of the day to midnight UTC
  dateUTC.setHours(0, 0, 0, 0);
  const startOfDayUTC = new Date(dateUTC.getTime());
  // Set the end of the day to 11:59:59.999 PM UTC
  dateUTC.setHours(23, 59, 59, 999);
  const endOfDayUTC = new Date(dateUTC.getTime());

  return {
    startOfDayUTC,
    endOfDayUTC,
  };
}

export const data = new SlashCommandBuilder()
  .setName("track-water")
  .setDescription("Track water intake")
  .addStringOption((option) =>
    option
      .setName("action")
      .setDescription("What would you like to do?")
      .setRequired(true)
      .addChoices(
        { name: "Add entry", value: "add" },
        { name: "Show today's entries", value: "today" },
        { name: "Show yesterday's entries", value: "yesterday" }
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

    const row = new ActionRowBuilder().addComponents(
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

        axios
          .post(`${apiUrl}/add`, {
            milliliters,
          })
          .then(async (apiResponse) => {
            const { message } = apiResponse.data;
            await confirmation.update({
              content: message ?? "No message, but success?",
              components: [],
            });
          })
          .catch((e) => console.error(e));
      }
    } catch (e) {
      console.error(e);
      await interaction.editReply({
        content: `Error! {e}`,
        components: [],
      });
    }
  } else if (interaction.options.getString("action") === "today") {
    const { startOfDayUTC, endOfDayUTC } = getDateOffsetUTCString(0);
    try {
      const response = await axios.get(
        `${apiUrl}/range?start=${startOfDayUTC}&end=${endOfDayUTC}`
      );
      const { data } = response;
      const items: WaterTrackerEntry[] = data.Items;
      const entries = items.map((item) => {
        const datetime = new Date(item.entry_datetime.S);
        return `${datetime.toLocaleString()} - ${item.milliliters.N}mL`;
      });
      const totalMl = items.reduce((acc, curr) => acc + +curr.milliliters.N, 0);
      await interaction.reply({
        content: `${CODE_START}${entries.join(
          "\n"
        )}\nToday's total water intake: ${totalMl}mL\n${CODE_END}`,
      });
    } catch (e) {
      console.error(e);
      await interaction.editReply({ content: `Error! ${e}` });
    }
  } else if (interaction.options.getString("action") === "yesterday") {
    const { startOfDayUTC, endOfDayUTC } = getDateOffsetUTCString(-1);
    try {
      const response = await axios.get(
        `${apiUrl}/range?start=${startOfDayUTC}&end=${endOfDayUTC}`
      );
      const { data } = response;
      const items: WaterTrackerEntry[] = data.Items;
      const entries = items.map((item) => {
        const datetime = new Date(item.entry_datetime.S);
        return `${datetime.toLocaleString()} - ${item.milliliters.N}mL`;
      });
      const totalMl = items.reduce((acc, curr) => acc + +curr.milliliters.N, 0);
      await interaction.reply({
        content: `${CODE_START}${entries.join(
          "\n"
        )}\nYesterday's total water intake: ${totalMl}mL\n${CODE_END}`,
      });
    } catch (e) {
      console.error(e);
      await interaction.editReply({ content: `Error! ${e}` });
    }
  } else {
    await interaction.reply(
      `${interaction.options.getString("action")} not implemented`
    );
  }
}
