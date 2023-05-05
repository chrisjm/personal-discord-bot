# personal-discord-bot

Personal Assistant Discord Bot built with Discord.js

## Getting Started

### 1. Setup

These are initial steps to get things running.

1. `npm install`
2. `echo "DISCORD_TOKEN=\nOPENAI_API_KEY=" >> .env`

### 2. Create a Discord Bot

Use your Discord login to access the Developers Portal (or sign up).

1. Go to the Discord Developers Portal and [create a **New Application**](https://discord.com/developers/applications).
2. Once created, click on **Settings > Bot** click on **Add Bot**.
3. Turn off **Public Bot**.
4. Under **Build-A-Bot**, copy the **Token** and paste in your `.env` file (see Getting Started)
5. Go to **General Information**, copy **Client ID**, and run `https://discord.com/oauth2/authorize?client_id={client_id}&scope=bot`

### 3. Run Bot

`npm start`
