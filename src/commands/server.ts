import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("server")
  .setDescription("Provides detailed information about the server.");

export async function execute(interaction: ChatInputCommandInteraction) {
  // Defer the reply first
  await interaction.deferReply();

  const guild = interaction.guild;
  
  if (!guild) {
    await interaction.editReply("This command can only be used in a server.");
    return;
  }

  // Create a rich embed with server information
  const serverEmbed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle(`Server Information: ${guild.name}`)
    .setThumbnail(guild.iconURL())
    .addFields(
      { name: "Server Name", value: guild.name, inline: true },
      { name: "Server ID", value: guild.id, inline: true },
      { name: "Created", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: false },
      { name: "Member Count", value: `${guild.memberCount} members`, inline: true },
      { name: "Boost Tier", value: `Tier ${guild.premiumTier}`, inline: true }
    );

  // Add owner information if available
  try {
    const owner = await guild.fetchOwner();
    serverEmbed.addFields(
      { name: "Server Owner", value: owner.user.username, inline: true }
    );
  } catch (error) {
    console.error("Could not fetch server owner:", error);
  }

  await interaction.editReply({ embeds: [serverEmbed] });
}
