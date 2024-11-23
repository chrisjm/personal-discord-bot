# personal-discord-bot

A feature-rich Personal Assistant Discord Bot built with Discord.js. This bot includes various capabilities such as GPT integration, meditation sessions, news tracking, financial tools, time management, and more.

## Features

- **GPT Integration**: Interact with GPT models for intelligent conversations
- **Meditation**: Start meditation sessions with timer and ambient sounds
- **News Tracking**: Follow and get updates from RSS feeds
- **Financial Tools**: Track cryptocurrency prices and stock market data
- **Time Management**: Handle timezone conversions and scheduling
- **Server & User Info**: Get information about servers and users
- **Database Integration**: Persistent storage using SQLite
- **Voice Channel Support**: High-quality voice features using Discord Voice API

## Prerequisites

- Node.js (v16 or higher)
- npm
- Discord Bot Token
- OpenAI API Key (for GPT features)
- SQLite (for data persistence)

## Tech Stack

- TypeScript
- Discord.js v14
- OpenAI API
- SQLite3
- Various APIs:
  - CoinGecko (cryptocurrency data)
  - Yahoo Finance (stock market data)
  - RSS Parser (news feeds)

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
4. Build the TypeScript code:
   ```bash
   npm run build
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
   # For production
   npm start

   # For development with watch mode
   npm run dev
   ```

## Available Commands

### General
- `/ping` - Check bot's latency, API latency, and uptime
- `/server` - Get detailed server information including member count and boost tier
- `/user` - Get user information

### AI & Chat
- `/gpt [prompt]` - Interact with GPT-4 model for intelligent conversations

### Wellness & Health
- `/meditate start [duration]` - Start a meditation session with ambient sounds (requires Meditation role)
  - Duration format: e.g., "5min"
- `/meditate stop` - Stop the current meditation session
- `/track-water [action]` - Track your daily water intake
  - Actions: add, today, range
- `/water-reminder [action]` - Set up automated water drinking reminders
  - `/water-reminder start [start_time] [end_time] [timezone]` - Start receiving reminders
  - `/water-reminder stop` - Stop receiving reminders

### Markets & Finance
- `/markets` - Get a comprehensive overview of global markets including:
  - US Markets (S&P 500, Dow Jones, NASDAQ)
  - European Markets (DAX, FTSE 100, CAC 40)
  - Asian Markets (Nikkei 225, Hang Seng, Shanghai)
  - Exchange Rates
  - Treasury Notes
  - Cryptocurrency prices

### News & Information
- `/news [action]` - Get news updates from trusted sources
  - Actions: 
    - `top` - Get top headlines
    - `yesterday` - Get popular news from yesterday

## Development

The project uses TypeScript for better type safety and developer experience. Key development commands:

```bash
# Build the project
npm run build

# Start in development mode with auto-reload
npm run dev

# Deploy slash commands
npm run deploy-commands
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - See LICENSE file for details
