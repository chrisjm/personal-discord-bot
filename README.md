# personal-discord-bot

A feature-rich Personal Assistant Discord Bot built with Discord.js. This bot includes various capabilities such as GPT integration, meditation sessions, news tracking, and more.

## Features

- **GPT Integration**: Interact with GPT models for intelligent conversations
- **Meditation**: Start meditation sessions with timer and ambient sounds
- **News Tracking**: Follow and get updates from RSS feeds
- **Music**: Track and manage music playback
- **Server & User Info**: Get information about servers and users

## Prerequisites

- Node.js (v16 or higher)
- npm
- Discord Bot Token
- OpenAI API Key (for GPT features)

## Getting Started

### 1. Setup

These are initial steps to get things running:

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create environment file:
   ```bash
   echo "DISCORD_TOKEN=\nOPENAI_API_KEY=" >> .env
   ```

### 2. Create a Discord Bot

1. Go to the [Discord Developers Portal](https://discord.com/developers/applications) and create a **New Application**
2. Navigate to **Settings > Bot** and click **Add Bot**
3. Configure bot settings:
   - Turn off **Public Bot**
   - Enable necessary Privileged Gateway Intents (Presence, Server Members, Message Content)
4. Under **Build-A-Bot**, copy the **Token** and paste it in your `.env` file
5. Go to **OAuth2 > URL Generator**:
   - Select scopes: `bot`, `applications.commands`
   - Select appropriate bot permissions
   - Use the generated URL to invite the bot to your server

### 3. Configure OpenAI (for GPT features)

1. Get your API key from [OpenAI's platform](https://platform.openai.com/)
2. Add the key to your `.env` file: `OPENAI_API_KEY=your_key_here`

### 4. Run the Bot

1. Deploy slash commands (only needed once or when commands change):
   ```bash
   npm run deploy-commands
   ```

2. Start the bot:
   ```bash
   npm start
   ```

## Available Commands

- `/gpt [prompt]` - Interact with GPT model
- `/meditate start [duration]` - Start a meditation session (from a Voice Channel)
- `/meditate stop` - Stop a meditation session (from a Voice Channel)
- `/news top` - Get top news from NewsAPI
- `/ping` - Check bot's connection
- `/server` - Get server information
- `/user` - Get user information

## Development

To start development mode:
```bash
npm run dev
```

## License

MIT License - See LICENSE file for details
