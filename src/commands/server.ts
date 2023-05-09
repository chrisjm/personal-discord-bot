import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("server")
  .setDescription("Provides information about the server.");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.reply(
    `This server is ${interaction.guild?.name ?? "Unnamed"} and has ${
      interaction.guild?.memberCount ?? 0
    } members.`
  );
}
