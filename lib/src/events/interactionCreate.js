"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = {
    name: discord_js_1.Events.InteractionCreate,
    async execute(interaction) {
        var _a;
        if (interaction.isChatInputCommand()) {
            const command = (_a = interaction.client.commands) === null || _a === void 0 ? void 0 : _a.get(interaction.commandName);
            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }
            try {
                await command.execute(interaction);
            }
            catch (error) {
                console.error(`Error executing ${interaction.commandName}`);
                console.error(error);
            }
        }
        else if (interaction.isButton()) {
            // respond to a permanent button
        }
        else if (interaction.isStringSelectMenu()) {
            // respond to a permanent select menu
        }
    },
};
