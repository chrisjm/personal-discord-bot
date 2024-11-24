import { Events, Message } from "discord.js";
import { openaiProvider } from "../commands/llms/providers/openai";
import { llmStats } from "../commands/llms/utils/stats";

// Default model to use for responses
const DEFAULT_MODEL = "gpt-3.5-turbo";

export default {
  name: Events.MessageCreate,
  async execute(message: Message) {
    // Ignore messages from bots (including self)
    if (message.author.bot) return;

    // Check if message is a DM or mentions the bot
    const isDM = message.channel.isDMBased();
    const isMention = message.mentions.users.has(message.client.user!.id);

    if (!isDM && !isMention) return;

    try {
      // Get the actual message content, removing the bot mention if present
      let prompt = message.content;
      if (isMention) {
        prompt = prompt.replace(new RegExp(`<@!?${message.client.user!.id}>`), "").trim();
      }

      // If the message is empty after removing mention, ignore it
      if (!prompt) return;

      // Show typing indicator while processing
      await message.channel.sendTyping();

      // Use the OpenAI provider to generate a response
      const result = await openaiProvider.complete(message, prompt, { model: DEFAULT_MODEL });

      // Record usage statistics
      await llmStats.recordUsage(
        message.author.id,
        openaiProvider.name,
        DEFAULT_MODEL,
        result.usage
      );

      // Send the response
      await message.reply({
        content: result.content,
        allowedMentions: { repliedUser: true }
      });

    } catch (error) {
      console.error("Error in message response:", error);
      await message.reply({
        content: "Sorry, I encountered an error while processing your message.",
        allowedMentions: { repliedUser: true }
      });
    }
  }
};
