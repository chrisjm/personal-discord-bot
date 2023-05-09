"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.execute = exports.data = void 0;
const discord_js_1 = require("discord.js");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName("server")
    .setDescription("Provides information about the server.");
async function execute(interaction) {
    var _a, _b, _c, _d;
    await interaction.reply(`This server is ${(_b = (_a = interaction.guild) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : "Unnamed"} and has ${(_d = (_c = interaction.guild) === null || _c === void 0 ? void 0 : _c.memberCount) !== null && _d !== void 0 ? _d : 0} members.`);
}
exports.execute = execute;
