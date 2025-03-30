import { Client, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, Interaction, MessageComponentInteraction, ButtonInteraction, ModalSubmitInteraction } from "discord.js";
import { ReminderHandler } from "../types/reminder";
import * as trackerDb from "../utils/trackingDatabase";
import * as streakService from "../utils/streakService";
import * as streakFormatter from "../utils/streakFormatter";
import { STREAK_TYPES, DEFAULT_DAILY_WATER_TARGET_ML } from "../constants/streaks";

// Constants for tracking
const MAX_REACTION_TIME_MS = 3600000; // 60 minutes
const TRACKING_TYPES = {
  WATER: "water",
  WATER_REACTION_TIME: "water_reaction_time",
};
const TRACKING_UNITS = {
  MILLILITERS: "ml",
  MILLISECONDS: "ms",
};

const REMINDER_MESSAGES = [
  "💧 H2O alert! Your cells are sending an SOS for hydration!",
  "🚰 Splash time! Your body's internal plants need watering.",
  "💦 Hydration station calling! Time to refuel your liquid levels.",
  "🌊 Water wizard says: Cast the spell of hydration upon thyself!",
  "💧 Brain fog? Water is the windshield wiper for your mind!",
  "🚰 Attention! Your personal ecosystem requires precipitation.",
  "💦 Psst... your kidneys just texted: 'Send water!'",
  "🌊 Mission: Hydration. Status: Pending. Action required!",
  "💧 Water o'clock! The universal time for quenching thirst.",
  "🚰 Friendly reminder: Humans are basically cucumbers with anxiety. Water yourself!",
  "💦 Plot twist: The hero of your story is... water! Drink up!",
  "🌊 Hydration vacation! Take a trip to Watertown, population: you.",
];

const CONGRATULATORY_MESSAGES = [
  "🎉 Hydration achievement unlocked! +10 to all human stats!",
  "💪 Water victory! Your cells are doing a happy dance right now.",
  "⭐ Splash-tastic! You're officially a hydro-homie!",
  "🌟 Magnificent moisturizing move! Your organs are applauding.",
  "🎊 H2-Whoa! You're absolutely crushing this water game!",
  "🏆 Liquid legend status achieved! Hydration hall of fame material.",
  "🚀 Cellular celebration in progress! Thanks to your hydration heroics.",
  "🌈 Brilliant! Your body's thirst sensors are doing a victory lap.",
];

const ENCOURAGEMENT_MESSAGES = [
  "💭 That's alright! Your next glass of water is your comeback story.",
  "🌱 No pressure! Your hydration journey has many chapters ahead.",
  "💪 Water you waiting for? Just kidding! Whenever you're ready.",
  "🌟 The path to peak hydration isn't always straight! You'll get there.",
  "💧 Even ocean waves take breaks! Grab some H2O when you can.",
  "🌿 Plot twist: Even cacti need water sometimes. You're doing great!",
  "🧠 Your future hydrated self is patiently waiting in the wings.",
  "🔮 I foresee a glass of water in your near future! The stars (and your cells) will thank you.",
];

const WATER_AMOUNT_ML = 250; // Assuming one glass of water is about 250ml

const getRandomFromArray = (arr: string[]): string =>
  arr[Math.floor(Math.random() * arr.length)];

// Button Custom IDs
const BUTTON_ID_LOG_250 = "log_water_250";
const BUTTON_ID_LOG_500 = "log_water_500";
const BUTTON_ID_LOG_CUSTOM = "log_water_custom";

// Modal Custom ID
const MODAL_ID_LOG_CUSTOM = "modal_log_water_custom";
const INPUT_ID_CUSTOM_AMOUNT = "input_custom_water_amount";

// --- Export necessary items for interactionCreate handler ---
export { logWaterEntry, MODAL_ID_LOG_CUSTOM, INPUT_ID_CUSTOM_AMOUNT, STREAK_TYPES, MAX_REACTION_TIME_MS };
// --- End Exports ---

// Helper function to log water entry
async function logWaterEntry(
  userId: string,
  amountMl: number,
  interaction: ButtonInteraction | ModalSubmitInteraction // Can be triggered by button or modal
) {
  try {
    await trackerDb.addEntry(
      userId,
      TRACKING_TYPES.WATER,
      amountMl,
      TRACKING_UNITS.MILLILITERS,
      `Logged via button/modal`
    );
    console.log(`[DEBUG] User ${userId} logged ${amountMl}ml of water.`);
  } catch (err) {
    console.error("Error logging water entry:", err);
    // Inform user about the error
    const errorReplyOptions = { content: "❌ Sorry, there was an error logging your water intake.", ephemeral: true };
    if (interaction.isRepliable()) {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(errorReplyOptions);
      } else {
        await interaction.reply(errorReplyOptions);
      }
    }
  }
}

export const waterReminderHandler: ReminderHandler = {
  type: "water",
  defaultMessages: REMINDER_MESSAGES,
  defaultFrequencyMinutes: 60, // Minimum default frequency
  defaultRandom: true,
  defaultFrequencyRandomMultiple: 1.5,

  onReminder: async (client: Client, userId: string) => {
    console.log(`[DEBUG] Water reminder handler started for user ${userId}`);
    const user = await client.users.fetch(userId);

    // Create buttons
    const log250Button = new ButtonBuilder()
      .setCustomId(BUTTON_ID_LOG_250)
      .setLabel("Log 250ml")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("💧"); // Optional emoji

    const log500Button = new ButtonBuilder()
      .setCustomId(BUTTON_ID_LOG_500)
      .setLabel("Log 500ml")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("🌊"); // Optional emoji

    const logCustomButton = new ButtonBuilder()
      .setCustomId(BUTTON_ID_LOG_CUSTOM)
      .setLabel("Log Custom...")
      .setStyle(ButtonStyle.Secondary);

    // Create action row
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(log250Button, log500Button, logCustomButton);

    // Send message with buttons
    const message = await user.send({
      content: getRandomFromArray(REMINDER_MESSAGES),
      components: [row], // Add the buttons
    });

    const reminderSentTime = Date.now();
    let streakUpdatedThisCycle = false; // Flag to ensure streak is updated only once

    // --- Reaction Collector (for consistency streak) ---
    const reactionCollector = message.createReactionCollector({
      filter: (reaction: any, reactUser: any) => reactUser.id === userId,
      max: 1,
      time: MAX_REACTION_TIME_MS,
    });

    reactionCollector.on("collect", async (reaction) => {
      if (streakUpdatedThisCycle) return; // Already handled by button
      streakUpdatedThisCycle = true;
      buttonCollector.stop(); // Stop listening for button clicks

      const reactionTime = Date.now() - reminderSentTime;
      console.log(`[DEBUG] User ${userId} reacted in ${reactionTime}ms`);

      // Track reaction time
      await trackerDb.addEntry(
        userId,
        TRACKING_TYPES.WATER_REACTION_TIME,
        reactionTime,
        TRACKING_UNITS.MILLISECONDS,
        `Reaction: ${reaction.emoji.name}`
      );

      // Update daily consistency streak
      const streakResult = await streakService.updateStreak(
        userId,
        STREAK_TYPES.WATER_DAILY_CONSISTENCY
      );

      // Fetch daily water total
      const todayDateStr = new Date().toISOString().split('T')[0];
      const dailyIntake = await trackerDb.getTotalForDay(userId, TRACKING_TYPES.WATER, todayDateStr);

      // Format and potentially send streak message
      const streakMessage = streakFormatter.formatStreakUpdateMessage(
        streakResult,
        dailyIntake,
        DEFAULT_DAILY_WATER_TARGET_ML
      );
      if (streakMessage) {
        // Send streak update in a separate message or followup
        try {
          await message.reply(streakMessage);
        } catch (err) {
          console.warn("Could not reply to original message for streak update (likely deleted):", err);
          try {
            await user.send(streakMessage); // Send as new DM if reply fails
          } catch (dmErr) {
            console.error("Failed to send streak update as DM:", dmErr);
          }
        }
      }

      // Disable buttons after interaction
      row.components.forEach((button) => button.setDisabled(true));
      try {
        await message.edit({ components: [row] });
      } catch (editErr) {
        console.warn("Could not edit message to disable buttons (likely deleted):", editErr);
      }
    });

    // --- Button Interaction Collector ---
    const buttonCollector = message.createMessageComponentCollector({
      filter: (i: MessageComponentInteraction) =>
        i.user.id === userId &&
        [BUTTON_ID_LOG_250, BUTTON_ID_LOG_500, BUTTON_ID_LOG_CUSTOM].includes(i.customId),
      max: 1, // Only collect one button interaction
      time: MAX_REACTION_TIME_MS,
    });

    buttonCollector.on("collect", async (interaction: ButtonInteraction) => {
      if (streakUpdatedThisCycle) return; // Already handled by reaction
      streakUpdatedThisCycle = true;
      reactionCollector.stop(); // Stop listening for reactions

      const interactionTime = Date.now() - reminderSentTime;
      console.log(`[DEBUG] User ${userId} interacted with button ${interaction.customId} after ${interactionTime}ms`);

      // Track interaction time (similar to reaction time)
      await trackerDb.addEntry(
        userId,
        TRACKING_TYPES.WATER_REACTION_TIME,
        interactionTime,
        TRACKING_UNITS.MILLISECONDS,
        `Button interaction: ${interaction.customId}`
      );

      // Update daily consistency streak
      const streakResult = await streakService.updateStreak(
        userId,
        STREAK_TYPES.WATER_DAILY_CONSISTENCY
      );

      // Fetch daily water total (needed for formatter)
      const todayDateStr = new Date().toISOString().split('T')[0];
      const dailyIntake = await trackerDb.getTotalForDay(userId, TRACKING_TYPES.WATER, todayDateStr);

      // Format and potentially send streak message
      const streakMessage = streakFormatter.formatStreakUpdateMessage(
        streakResult,
        dailyIntake,
        DEFAULT_DAILY_WATER_TARGET_ML
      );
      if (streakMessage) {
        // Send streak update as a new DM instead of follow-up
        try {
          await user.send(streakMessage);
        } catch (dmErr) {
          console.error(`Failed to send streak update DM to user ${userId}:`, dmErr);
        }
      }

      // Handle specific button
      try {
        if (interaction.customId === BUTTON_ID_LOG_250) {
          await logWaterEntry(userId, 250, interaction);
        } else if (interaction.customId === BUTTON_ID_LOG_500) {
          await logWaterEntry(userId, 500, interaction);
        } else if (interaction.customId === BUTTON_ID_LOG_CUSTOM) {
          // Show Modal
          const modal = new ModalBuilder()
            .setCustomId(MODAL_ID_LOG_CUSTOM)
            .setTitle("Log Custom Water Amount");

          const amountInput = new TextInputBuilder()
            .setCustomId(INPUT_ID_CUSTOM_AMOUNT)
            .setLabel("Amount (in ml)")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("e.g., 750")
            .setRequired(true);

          const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(amountInput);
          modal.addComponents(firstActionRow);

          await interaction.showModal(modal);
          // Modal submission is handled separately (see Step 6)
        }
      } catch (error) {
        console.error("Error handling button interaction:", error);
        if (interaction.isRepliable()) {
          const opts = { content: "An error occurred while processing your request.", ephemeral: true };
          if (interaction.replied || interaction.deferred) await interaction.followUp(opts);
          else await interaction.reply(opts);
        }
      }

      // Disable buttons after interaction (unless it was the modal trigger)
      if (interaction.customId !== BUTTON_ID_LOG_CUSTOM) {
        row.components.forEach((button) => button.setDisabled(true));
        try {
          await message.edit({ components: [row] });
        } catch (editErr) {
          console.warn("Could not edit message to disable buttons (likely deleted):", editErr);
        }
      }
    });

    // --- Handle Collector End (Timeout) ---
    // Combine logic: use the reaction collector's end event, but check the flag
    reactionCollector.on("end", async (collected) => {
      if (!streakUpdatedThisCycle && collected.size === 0) {
        // Only run if no reaction AND no button was pressed
        console.log(`[DEBUG] No reaction or button press from user ${userId} within timeout`);

        // Ensure button collector is also stopped
        if (!buttonCollector.ended) buttonCollector.stop();

        // Track no reaction at max time
        await trackerDb.addEntry(
          userId,
          TRACKING_TYPES.WATER_REACTION_TIME,
          MAX_REACTION_TIME_MS,
          TRACKING_UNITS.MILLISECONDS,
          "No interaction (timeout)"
        );

        // Update streak (will likely break streak or reset to 1)
        await streakService.updateStreak(userId, STREAK_TYPES.WATER_DAILY_CONSISTENCY);

        // Potentially inform user about timeout/streak break via DM?
      }
    });
  },
};
