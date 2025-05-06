import cron from "node-cron";
import {
  fetchAndSummarize,
  getChannelId,
  getCronSchedule,
} from "../utils/blueskyService";
import { Client, TextChannel } from "discord.js";

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

    // Get the AI-generated summary
    const summary = await fetchAndSummarize(
      startTime.toISOString(),
      now.toISOString(),
    );

    if (!summary) {
      console.log(
        `No Bluesky posts to summarize for the past ${timeRangeMinutes} minutes`,
      );
      return;
    }

    // Get the channel and send the summary
    const channel = client.channels.cache.get(channelId) as TextChannel;
    if (!channel) {
      console.error(`Could not find channel with ID ${channelId}`);
      return;
    }

    // Send the AI-generated summary directly to the channel
    await channel.send(summary);
    console.log("Bluesky summary posted successfully");
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
  const testingSchedule = "*/5 * * * *"; // Every 5 minutes
  console.log(
    `Scheduling Bluesky summaries to run every 5 minutes for testing`,
  );

  // Schedule the recurring task
  cron.schedule(testingSchedule, async () => {
    // Use a 5-minute window for testing
    await fetchAndSendSummary(client, 5);
  });

  // Run immediately on startup with a 30-minute window
  console.log("Running initial Bluesky summary on startup...");
  setTimeout(() => {
    fetchAndSendSummary(client, 30).catch((error) => {
      console.error("Error running initial Bluesky summary:", error);
    });
  }, 5000); // Wait 5 seconds after bot startup before running
}
