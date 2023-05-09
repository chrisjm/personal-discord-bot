"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.execute = exports.data = void 0;
const got_1 = __importDefault(require("got"));
const discord_js_1 = require("discord.js");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const apiUrl = process.env.API_URL;
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName("track")
    .setDescription("Track stuff")
    .addSubcommand((subcommand) => subcommand.setName("water").setDescription("Track water intake"))
    .addSubcommand((subcommand) => subcommand.setName("mindfulness").setDescription("Track mindfulness"));
async function execute(interaction) {
    if (interaction.options.getSubcommand() === "water") {
        const addHalfLiter = new discord_js_1.ButtonBuilder()
            .setCustomId("500-ml")
            .setLabel("500mL")
            .setStyle(discord_js_1.ButtonStyle.Primary);
        const addLiter = new discord_js_1.ButtonBuilder()
            .setCustomId("1000-ml")
            .setLabel("1L")
            .setStyle(discord_js_1.ButtonStyle.Secondary);
        const cancel = new discord_js_1.ButtonBuilder()
            .setCustomId("cancel")
            .setLabel("Cancel")
            .setStyle(discord_js_1.ButtonStyle.Danger);
        const row = new discord_js_1.ActionRowBuilder().addComponents(addHalfLiter, addLiter, cancel);
        const response = await interaction.reply({
            content: `How much water would you like to add?`,
            components: [row],
        });
        const collectorFilter = (i) => i.user.id === interaction.user.id;
        try {
            const confirmation = await response.awaitMessageComponent({
                filter: collectorFilter,
                time: 60000,
            });
            if (confirmation.customId === "cancel") {
                await confirmation.update({
                    content: "Action cancelled",
                    components: [],
                });
            }
            else {
                const milliliters = parseInt(confirmation.customId.split("-")[0]);
                const apiResponse = await got_1.default.post(`${apiUrl}/add`, {
                    json: {
                        milliliters,
                    },
                });
                const { message } = JSON.parse(apiResponse.body);
                await confirmation.update({
                    content: message,
                    components: [],
                });
            }
        }
        catch (e) {
            console.error(e);
            await interaction.editReply({
                content: `Error! {e}`,
                components: [],
            });
        }
    }
    else if (interaction.options.getSubcommand() === "mindfulness") {
        await interaction.reply(`not implemented`);
    }
}
exports.execute = execute;
