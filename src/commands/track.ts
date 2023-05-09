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

export const data = new SlashCommandBuilder()
  .setName("track-water")
  .setDescription("Track water intake")
  .addStringOption((option) =>
    option
      .setName("action")
      .setDescription("What would you like to do?")
      .setRequired(true)
      .addChoices({ name: "Add", value: "add" })
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
  } else {
    await interaction.reply(`not implemented`);
  }
}
