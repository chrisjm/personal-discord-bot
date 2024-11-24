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
  AudioPlayer,
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
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("stop")
      .setDescription("Stop the meditation session and disconnect the bot."),
  );

let connection: VoiceConnection | null = null;
let subscription: PlayerSubscription;
let timeoutId: NodeJS.Timeout;

export async function playResource(audioPlayer: AudioPlayer, resource: any) {
  audioPlayer.play(resource);
  return entersState(audioPlayer, AudioPlayerStatus.Playing, 5_000);
}

async function connectToChannel(channel: VoiceBasedChannel) {
  const connection = joinVoiceChannel({
    channelId: channel?.id,
    guildId: channel?.guild?.id,
    // @ts-ignore Type incompatibility; re-evaluate later (2024-11-23)
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

  // Check for the specific role
  const member = interaction.member as GuildMember;
  if (!member?.roles?.cache?.some((role) => role.name === "Meditation")) {
    await interaction.reply({
      content: "You do not have the required role to use this command.",
      ephemeral: true,
    });
    return;
  }

  if (subcommand === "start") {
    await handleStart(interaction);
  } else if (subcommand === "stop") {
    await handleStop(interaction);
  }
}

async function handleStart(interaction: ChatInputCommandInteraction) {
  let audioPlayer = createAudioPlayer();

  // Meditation Music
  const musicAudioPath = join(__dirname, "assets", "meditation-opus.ogg");
  const musicResource = createAudioResource(createReadStream(musicAudioPath), {
    inputType: StreamType.OggOpus,
    metadata: {
      title: "9 Solfeggio Frequencies",
    },
  });

  // Starting Meditation Bell
  const bellAudioPath = join(
    __dirname,
    "assets",
    "tibetan-bell-ding-b-note.mp3",
  );
  const startBellResource = createAudioResource(bellAudioPath, {
    metadata: {
      title: "Start Meditation Bell",
    },
  });

  // Ending Meditation Bell
  const endBellResource = createAudioResource(bellAudioPath, {
    metadata: {
      title: "End Meditation Bell",
    },
  });

  const durationString = interaction.options.getString("duration");

  // Convert duration string to milliseconds
  const duration = parseDuration(durationString);
  if (!duration) {
    await interaction.reply(
      "Invalid duration format. Please use something like `5min`.",
    );
    return;
  }

  const meditationChannelId = process.env.MEDITATION_CHANNEL_ID;

  if (!meditationChannelId) {
    console.error("MEDITATION_CHANNEL_ID is not set in environment.");
    await interaction.reply(
      "Configuration error. Please contact the administrator.",
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
      subscription = connection.subscribe(audioPlayer) as PlayerSubscription;

      await interaction.reply(
        `Playing meditation music for ${durationString}. 🔊`,
      );

      // Play the beginning bell and wait 30s for it to complete
      console.log("Starting Bell!");
      await playResource(audioPlayer, startBellResource);
      await entersState(audioPlayer, AudioPlayerStatus.Idle, 30_000);
      console.log("Starting Bell Finished!");

      console.log("Playing music...");
      await playResource(audioPlayer, musicResource);

      // Play meditation music and then play ending bell and disconnect
      console.log(`Setting timeout for ${duration}ms`);
      timeoutId = setTimeout(async () => {
        console.log("Ending music, playing Ending Bell!");
        await playResource(audioPlayer, endBellResource);
        await entersState(audioPlayer, AudioPlayerStatus.Idle, 30_000);
        console.log("Ending Bell Finished! Stopping...");
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

  audioPlayer.on("error", (error) => {
    console.error(`Error: ${error.message}`);
  });

  audioPlayer.on("stateChange", (oldState, newState) => {
    console.log(
      `Audio player transitioned from ${oldState.status} to ${newState.status}`,
    );
  });
}

async function handleStop(interaction: ChatInputCommandInteraction) {
  if (!interaction.isCommand()) return;
  const channel = interaction.channel as VoiceBasedChannel;

  // Communicate
  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply(
        "Stopping the meditation session and disconnecting. 👋",
      );
    } else if (channel) {
      await channel.send(
        "Stopping the meditation session and disconnecting. 👋",
      );
    } else {
      console.error("Could not find the channel.");
    }
  } catch (error) {
    console.error("Error handling interaction:", error);
  }

  if (timeoutId) {
    console.log(`Clearing timeout ${timeoutId}...`);
    clearTimeout(timeoutId);
  }

  if (subscription) {
    console.log("Unsubscribing and disconnecting...");
    subscription?.unsubscribe();
    connection?.disconnect();
  } else {
    console.error("Bot is not connected to a voice channel.");
  }
}
