"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.execute = exports.data = void 0;
const discord_js_1 = require("discord.js");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName("track")
    .setDescription("Track stuff");
async function execute(interaction) {
    const trackerSelect = new discord_js_1.StringSelectMenuBuilder()
        .setCustomId("trackerSelect")
        .setPlaceholder("Make a selection!")
        .addOptions(new discord_js_1.StringSelectMenuOptionBuilder()
        .setLabel("Water")
        .setDescription("Track water intake.")
        .setValue("water"), new discord_js_1.StringSelectMenuOptionBuilder()
        .setLabel("Mindfulness")
        .setDescription("Track mindfulness and anxiety. (not implmented)")
        .setValue("mindfulness"));
    const waterActionSelect = new discord_js_1.StringSelectMenuBuilder()
        .setCustomId("waterActionSelect")
        .setPlaceholder("What would you like to do?")
        .addOptions(new discord_js_1.StringSelectMenuOptionBuilder()
        .setLabel("Add")
        .setDescription("Add water intake.")
        .setValue("add"));
    const trackerSelectRow = new discord_js_1.ActionRowBuilder().addComponents(trackerSelect);
    const waterActionSelectRow = new discord_js_1.ActionRowBuilder().addComponents(waterActionSelect);
    const response = await interaction.reply({
        content: "What would you like to track?",
        components: [trackerSelectRow],
        ephemeral: true,
    });
    // Security: Ensure the same user made the interaction
    const collectorFilter = (i) => i.user.id === interaction.user.id;
    try {
        const trackerSelectResponse = await response.awaitMessageComponent({
            filter: collectorFilter,
            time: 30000,
        });
        const selection = trackerSelectResponse.values[0];
        if (selection === "water") {
            await trackerSelectResponse.update({
                content: `Water is life!`,
                components: [waterActionSelectRow],
            });
            console.log(response);
        }
        else if (selection === "mindfulness") {
            await trackerSelectResponse.update({
                content: `The Mindfulness Tracker isn't implemented, yet.`,
                components: [],
            });
        }
        else {
            await trackerSelectResponse.update({
                content: `Selection ${selection} invalid.`,
                components: [],
            });
        }
    }
    catch (e) {
        await interaction.editReply({
            content: "Selecton not received within 30 seconds, cancelling",
            components: [],
        });
    }
}
exports.execute = execute;
