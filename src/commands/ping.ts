import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Shows bot latency and other stats");

export async function execute(interaction: ChatInputCommandInteraction) {
  const sent = await interaction.deferReply({ fetchReply: true });
  const pingLatency = sent.createdTimestamp - interaction.createdTimestamp;
  const apiLatency = Math.round(interaction.client.ws.ping);

  const uptime = process.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle("🏓 Pong!")
    .addFields(
      { name: "Bot Latency", value: `${pingLatency}ms`, inline: true },
      { name: "API Latency", value: `${apiLatency}ms`, inline: true },
      {
        name: "Uptime",
        value: `${days}d ${hours}h ${minutes}m ${seconds}s`,
        inline: false,
      },
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
