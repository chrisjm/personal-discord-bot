import cron from "node-cron";
import {
  fetchAndSummarize,
  getChannelId,
} from "../utils/blueskyService";
import { Client, TextChannel, MessageFlags } from "discord.js";

/**
 * Fetches Bluesky posts and sends the AI-generated summary to a Discord channel
 */
async function fetchAndSendSummary(
  client: Client,
  timeRangeMinutes = 60,
): Promise<void> {
  const channelId = getChannelId();

  if (!channelId) {
    console.warn("Bluesky summary not sent: missing channel ID");
    return;
  }

  try {
    // Calculate the time range
    const now = new Date();
    const startTime = new Date(now.getTime() - timeRangeMinutes * 60 * 1000);

    console.log(
      `Fetching Bluesky feed summary for the past ${timeRangeMinutes} minutes (${startTime.toISOString()} to ${now.toISOString()})...`,
    );

    // Get the AI-generated summary chunks
    const summaryChunks = await fetchAndSummarize(
      startTime.toISOString(),
      now.toISOString(),
    );

    if (!summaryChunks || summaryChunks.length === 0) {
      console.log(
        `No Bluesky posts to summarize for the past ${timeRangeMinutes} minutes`,
      );
      return;
    }

    // Get the channel and send the summary chunks
    const channel = client.channels.cache.get(channelId) as TextChannel;
    if (!channel) {
      console.error(`Could not find channel with ID ${channelId}`);
      return;
    }

    // Send each chunk with a small delay to avoid rate limiting
    const sendMessageWithDelay = async (chunks: string[], index = 0) => {
      if (index >= chunks.length) {
        console.log(`Bluesky summary posted successfully (${chunks.length} messages)`);
        return;
      }

      if (chunks[index].trim()) { // Only send non-empty messages
        await channel.send({
          content: chunks[index],
          flags: MessageFlags.SuppressEmbeds // Disable link embeds
        });
      }

      // Wait 1 second between messages to avoid rate limiting
      setTimeout(() => sendMessageWithDelay(chunks, index + 1), 1000);
    };

    // Start sending messages
    await sendMessageWithDelay(summaryChunks);

  } catch (error) {
    console.error("Error posting Bluesky summary:", error);
  }
}

/**
 * Schedules Bluesky feed summaries and runs on startup
 */
export function scheduleBlueskySummaries(client: Client) {
  const channelId = getChannelId();

  if (!channelId) {
    console.warn("Bluesky summaries not scheduled: missing channel ID");
    return;
  }

  // Testing: Use a 5-minute schedule instead of the configured one
  const testingSchedule = "*/30 * * * *"; // Every 30 minutes
  console.log(
    `Scheduling Bluesky summaries to run every 30 minutes for testing`,
  );

  // Schedule the recurring task
  cron.schedule(testingSchedule, async () => {
    // Use a 30-minute window for testing
    await fetchAndSendSummary(client, 30);
  });

  // Run immediately on startup with a 30-minute window
  console.log("Running initial Bluesky summary on startup...");
  setTimeout(() => {
    fetchAndSendSummary(client, 30).catch((error) => {
      console.error("Error running initial Bluesky summary:", error);
    });
  }, 5000); // Wait 5 seconds after bot startup before running
}
