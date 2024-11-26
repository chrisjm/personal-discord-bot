import { Client } from "discord.js";
import { ReminderHandler } from "../types/reminder";
import * as trackerDb from "../utils/trackingDatabase";

const REMINDER_MESSAGES = [
  "💧 Time for a water break! Stay hydrated!",
  "🚰 Hey there! Remember to drink some water!",
  "💦 Hydration check! Take a moment to drink some water.",
  "🌊 Your body needs water to function at its best. Time for a drink!",
  "💧 Did you know? Staying hydrated helps improve focus and energy. Drink up!",
  "🚰 Quick reminder to take care of yourself - have some water!",
  "💦 Water break time! Your future self will thank you.",
  "🌊 Stay awesome, stay hydrated! Time for some H2O!",
];

const CONGRATULATORY_MESSAGES = [
  "🎉 Great job staying hydrated!",
  "💪 Your body thanks you for that water!",
  "⭐ Keep up the great hydration habits!",
  "🌟 Awesome! Your future self will thank you for staying hydrated!",
  "🎊 That's the spirit! Stay hydrated, stay healthy!",
];

const ENCOURAGEMENT_MESSAGES = [
  "💭 No worries! Remember, staying hydrated helps you feel more energetic!",
  "🌱 Maybe next time! Water is your body's best friend.",
  "💪 You've got this! Try to get some water when you can.",
  "🌟 That's okay! Just remember to drink water when you get the chance.",
  "💧 Take care of yourself! Even small sips throughout the day help.",
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
    console.log(`[DEBUG] Sent reminder message to user ${userId}`);

    // Start collecting reactions but don't await it
    // Create a filter for the collector
    const filter = (reaction: any, reactUser: any) =>
      ["👍", "👎"].includes(reaction.emoji.name) && reactUser.id === userId;

    // Set up the collector without awaiting it
    const collector = message.createReactionCollector({
      filter,
      max: 1,
      time: 300000, // 5 minutes timeout
    });

    // Handle reactions asynchronously
    collector.on('collect', async (reaction) => {
      if (reaction.emoji.name === "👍") {
        // User drank water
        console.log(`[DEBUG] User ${userId} confirmed drinking water`);
        await trackerDb.addEntry(
          "water",
          WATER_AMOUNT_ML,
          "ml",
          "Water reminder",
        );
        await message.reply(getRandomFromArray(CONGRATULATORY_MESSAGES));
      } else {
        // User didn't drink water
        console.log(`[DEBUG] User ${userId} declined drinking water`);
        await message.reply(getRandomFromArray(ENCOURAGEMENT_MESSAGES));
      }
    });

    collector.on('end', (collected) => {
      if (collected.size === 0) {
        console.log(`[DEBUG] No reaction received from user ${userId} after timeout`);
      }
    });
  },
};
