"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.execute = exports.data = void 0;
const discord_js_1 = require("discord.js");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName("track")
    .setDescription("Track stuff");
async function execute(interaction) {
    const select = new discord_js_1.StringSelectMenuBuilder()
        .setCustomId("starter")
        .setPlaceholder("Make a selection!")
        .addOptions(new discord_js_1.StringSelectMenuOptionBuilder()
        .setLabel("Water")
        .setDescription("Track water intake.")
        .setValue("water"), new discord_js_1.StringSelectMenuOptionBuilder()
        .setLabel("Mindfulness")
        .setDescription("Track mindfulness and anxiety. (not implmented)")
        .setValue("mindfulness"));
    const row = new discord_js_1.ActionRowBuilder().addComponents(select);
    await interaction.reply({
        content: "What would you like to track?",
        components: [row],
    });
}
exports.execute = execute;
