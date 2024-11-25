import dotenv from "dotenv";
import path from "path";
import * as fs from "fs";
import { REST, Routes } from "discord.js";

dotenv.config();

// Assumes all commands are in the commands folder
const commands = [];
const foldersPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(foldersPath)
  .filter((file) => file.endsWith(".ts"));

// Push all commands as JSON to the array
for (const file of commandFiles) {
  const filePath = path.join(foldersPath, file);
  const command = require(filePath);
  if ("data" in command && "execute" in command) {
    commands.push(command.data.toJSON());
  } else {
    console.log(
      `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
    );
  }
}

// Create a new REST object
const rest = new REST().setToken(process?.env?.DISCORD_TOKEN ?? "");

// Deploy all commands
(async () => {
  try {
    console.log(
      `Started refreshing ${commands.length} application (/) commands.`,
    );

    // The put method is used to fully refresh all commands in the guild with the current set
    const data = await rest.put(
      Routes.applicationGuildCommands(
        process?.env?.DISCORD_CLIENT_ID ?? "",
        process?.env?.DISCORD_GUILD_ID ?? "",
      ),
      { body: commands },
    );

    console.log(
      `Successfully reloaded ${Array.isArray(data) ? data.length : 0} application (/) commands.`,
    );
  } catch (error) {
    console.error(error);
  }
})();
