import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  GuildMember,
  PermissionFlagsBits,
  VoiceBasedChannel,
} from "discord.js";
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  entersState,
  VoiceConnectionStatus,
  AudioPlayerStatus,
  StreamType,
  VoiceConnection,
  PlayerSubscription,
} from "@discordjs/voice";
import { join } from "path";
import { createReadStream } from "fs";

export const data = new SlashCommandBuilder()
  .setName("meditate")
  .setDescription("Meditation commands")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("start")
      .setDescription("Start the meditation session.")
      .addStringOption((option) =>
        option
          .setName("duration")
          .setDescription("Duration for the meditation session, e.g., 5min")
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("stop")
      .setDescription("Stop the meditation session and disconnect the bot.")
  );

let connection: VoiceConnection | null = null;
let subscription: PlayerSubscription;

const player = createAudioPlayer();

// Meditation Music
const audioPath = join(__dirname, "assets", "meditation-opus.ogg");
const resource = createAudioResource(createReadStream(audioPath), {
  inputType: StreamType.OggOpus,
});

export function playMusic() {
  player.play(resource);
  return entersState(player, AudioPlayerStatus.Playing, 5_000);
}

async function connectToChannel(channel: VoiceBasedChannel) {
  const connection = joinVoiceChannel({
    channelId: channel?.id,
    guildId: channel?.guild?.id,
    adapterCreator: channel?.guild?.voiceAdapterCreator,
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
    return connection;
  } catch (error) {
    connection.destroy();
    throw error;
  }
}

function parseDuration(durationString: string | null): number | null {
  // Example parsing logic: "5min" -> 5 * 60 * 1000 ms
  if (!durationString) return null;
  const match = durationString.match(/^(\d+)(min|m)$/);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  if (unit === "min" || unit === "m") {
    return value * 60 * 1000;
  }

  return null;
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "start") {
    await handleStart(interaction);
  } else if (subcommand === "stop") {
    await handleStop(interaction);
  }
}

async function handleStart(interaction: ChatInputCommandInteraction) {
  const durationString = interaction.options.getString("duration");

  // Convert duration string to milliseconds
  const duration = parseDuration(durationString);
  if (!duration) {
    await interaction.reply(
      "Invalid duration format. Please use something like `5min`."
    );
    return;
  }

  const meditationChannelId = process.env.MEDITATION_CHANNEL_ID;

  if (!meditationChannelId) {
    console.error("MEDITATION_CHANNEL_ID is not set in environment.");
    await interaction.reply(
      "Configuration error. Please contact the administrator."
    );
    return;
  }

  const member = interaction.member as GuildMember;
  if (!member) {
    await interaction.reply("You must be a member to start the meditation.");
    return;
  }

  const channel = member.voice.channel;

  if (channel) {
    try {
      connection = await connectToChannel(channel);

      subscription = connection.subscribe(player);
      await interaction.reply(
        `Playing meditation music for ${durationString}.`
      );

      await playMusic();

      setTimeout(async () => {
        await handleStop(interaction);
      }, duration);

      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          connection?.destroy();
        } catch (e) {
          console.error(e);
        }
      });
    } catch (error) {
      console.error(error);
    }
  } else {
    await interaction.reply("Join a voice channel then try again!");
  }

  player.on("error", (error) => {
    console.error(`Error: ${error.message}`);
  });

  player.on("stateChange", (oldState, newState) => {
    console.log(
      `Audio player transitioned from ${oldState.status} to ${newState.status}`
    );
  });
}

async function handleStop(interaction: ChatInputCommandInteraction) {
  if (!interaction.isCommand()) return;

  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply(
        "Stopping the meditation session and disconnecting."
      );
    } else {
      console.log("Interaction has already been replied to or deferred.");
    }
  } catch (error) {
    console.error("Error handling interaction:", error);
  }

  if (subscription) {
    subscription.unsubscribe();
    connection?.disconnect();
  } else {
    await interaction.reply("Bot is not connected to a voice channel.");
  }
}
