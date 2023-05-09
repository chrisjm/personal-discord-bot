"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.execute = exports.data = void 0;
const discord_js_1 = require("discord.js");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName("user")
    .setDescription("Provides information about the user.");
async function execute(interaction) {
    var _a, _b;
    await interaction.reply(`This command was run by ${interaction.user.username}, who joined on ${(_b = (_a = interaction.member) === null || _a === void 0 ? void 0 : _a.joinedAt) !== null && _b !== void 0 ? _b : ""}.`);
}
exports.execute = execute;
