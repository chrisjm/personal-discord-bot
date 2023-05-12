import * as dotenv from "dotenv";
dotenv.config();

import spacetime from "spacetime";
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
    const now = spacetime.now("America/Los_Angeles");
    try {
      const response = await axios.get(
        `${apiUrl}/range?start=${now.startOf("day").format("iso")}&end=${now
          .endOf("day")
          .format("iso")}`
      );
      const { data } = response;
      const items: WaterTrackerEntry[] = data.Items;
      const entries = items.map((item) => {
        const datetime = spacetime(new Date(item.entry_datetime.S));
        return `${datetime.goto("America/Los_Angeles").format("nice")} - ${
          item.milliliters.N
        }mL`;
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
  } else if (interaction.options.getString("action") === "range") {
    const now = spacetime.now("America/Los_Angeles");

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

    const minusFiveDays = new ButtonBuilder()
      .setCustomId("minus-5")
      .setLabel("-5 Days")
      .setStyle(ButtonStyle.Primary);

    const cancel = new ButtonBuilder()
      .setCustomId("cancel")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(
      yesterday,
      minusTwoDays,
      minusThreeDays,
      minusFourDays,
      minusFiveDays,
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
        const response = await axios.get(
          `${apiUrl}/range?start=${rangeDate
            .startOf("day")
            .format("iso")}&end=${rangeDate.endOf("day").format("iso")}`
        );
        const { data } = response;
        const items: WaterTrackerEntry[] = data.Items;
        const entries = items.map((item) => {
          const datetime = spacetime(new Date(item.entry_datetime.S));
          return `${datetime.goto("America/Los_Angeles").format("nice")} - ${
            item.milliliters.N
          }mL`;
        });
        const totalMl = items.reduce(
          (acc, curr) => acc + +curr.milliliters.N,
          0
        );
        await confirmation.update({
          content: `${CODE_START}${entries.join(
            "\n"
          )}\nTotal water intake: ${totalMl}mL\n${CODE_END}`,
          components: [],
        });
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
