import { Client } from "discord.js";
import { ReminderHandler } from "../types/reminder";
import * as trackerDb from "../utils/trackingDatabase";

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

export const waterReminderHandler: ReminderHandler = {
  type: "water",
  defaultMessages: REMINDER_MESSAGES,
  defaultFrequencyMinutes: 60, // Minimum default frequency
  defaultRandom: true,
  defaultFrequencyRandomMultiple: 1.5,

  onReminder: async (client: Client, userId: string) => {
    console.log(`[DEBUG] Water reminder handler started for user ${userId}`);
    const user = await client.users.fetch(userId);
    const message = await user.send(getRandomFromArray(REMINDER_MESSAGES));

    // Store the timestamp when the reminder was sent
    const reminderSentTime = Date.now();
    console.log(
      `[DEBUG] Sent reminder message to user ${userId} at ${reminderSentTime}`,
    );

    // Start collecting reactions but don't await it
    // Create a filter for the collector
    const filter = (reaction: any, reactUser: any) => reactUser.id === userId; // Accept any reaction from the user

    // Set up the collector without awaiting it
    const collector = message.createReactionCollector({
      filter,
      max: 1,
      time: MAX_REACTION_TIME_MS,
    });

    // Handle reactions asynchronously
    collector.on("collect", async (reaction) => {
      // Calculate reaction time in milliseconds
      const reactionTime = Date.now() - reminderSentTime;
      console.log(
        `[DEBUG] User ${userId} reacted in ${reactionTime}ms with ${reaction.emoji.name}`,
      );

      // Track the reaction time regardless of reaction type
      await trackerDb.addEntry(
        userId,
        TRACKING_TYPES.WATER_REACTION_TIME,
        reactionTime,
        TRACKING_UNITS.MILLISECONDS,
        `Reaction: ${reaction.emoji.name}`,
      );

      if (reaction.emoji.name === "👍") {
        // User drank water
        console.log(`[DEBUG] User ${userId} confirmed drinking water`);
        await trackerDb.addEntry(
          userId,
          TRACKING_TYPES.WATER,
          WATER_AMOUNT_ML,
          TRACKING_UNITS.MILLILITERS,
          "Water reminder",
        );
        await message.reply(getRandomFromArray(CONGRATULATORY_MESSAGES));
      } else if (reaction.emoji.name === "👎") {
        // User didn't drink water
        console.log(`[DEBUG] User ${userId} declined drinking water`);
        await message.reply(getRandomFromArray(ENCOURAGEMENT_MESSAGES));
      } else {
        // User reacted with something else
        console.log(
          `[DEBUG] User ${userId} reacted with ${reaction.emoji.name}`,
        );
        await message.reply(
          "Thanks for acknowledging the reminder! Remember to stay hydrated!",
        );
      }
    });

    collector.on("end", async (collected) => {
      if (collected.size === 0) {
        console.log(
          `[DEBUG] No reaction received from user ${userId} after timeout`,
        );
        // Track no reaction at max time
        await trackerDb.addEntry(
          userId,
          TRACKING_TYPES.WATER_REACTION_TIME,
          MAX_REACTION_TIME_MS,
          TRACKING_UNITS.MILLISECONDS,
          "No reaction",
        );
      }
    });
  },
};
