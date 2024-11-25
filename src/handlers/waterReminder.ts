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
    const user = await client.users.fetch(userId);
    const message = await user.send(getRandomFromArray(REMINDER_MESSAGES));

    try {
      // Create a filter for the collector
      const filter = (reaction: any, reactUser: any) =>
        ["👍", "👎"].includes(reaction.emoji.name) && reactUser.id === userId;

      // Wait for a reaction
      const collected = await message.awaitReactions({
        filter,
        max: 1,
        time: 300000, // wait for 5 minutes
        errors: ["time"],
      });

      const reaction = collected.first();
      if (!reaction) return;

      if (reaction.emoji.name === "👍") {
        // User drank water
        await trackerDb.addEntry(
          "water",
          WATER_AMOUNT_ML,
          "ml",
          "Water reminder",
        );
        await message.reply(getRandomFromArray(CONGRATULATORY_MESSAGES));
      } else {
        // User didn't drink water
        await message.reply(getRandomFromArray(ENCOURAGEMENT_MESSAGES));
      }
    } catch (error) {
      // No reaction after 5 minutes
      console.log("No reaction received for water reminder.");
    }
  },
};
