import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import { openaiProvider } from "./providers/openai";
import { llmStats } from "./utils/stats";
import { LLMProvider } from "../../types/llm";

// Initialize providers
const providers: { [key: string]: LLMProvider } = {
  openai: openaiProvider,
  // Add more providers here as they're implemented
};

export const data = new SlashCommandBuilder()
  .setName("llm")
  .setDescription("Interact with various LLM models")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("chat")
      .setDescription("Chat with an LLM model")
      .addStringOption((option) =>
        option
          .setName("model")
          .setDescription("The model to use")
          .setRequired(true)
          .addChoices(
            { name: "GPT-4 Mini", value: "gpt-4o-mini" },
            { name: "GPT-4", value: "gpt-4o" },
            { name: "GPT-3.5 Turbo", value: "gpt-3.5-turbo" },
          ),
      )
      .addStringOption((option) =>
        option
          .setName("prompt")
          .setDescription("Your message to the model")
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("stats")
      .setDescription("View your LLM usage statistics")
      .addIntegerOption((option) =>
        option
          .setName("days")
          .setDescription("Number of days to show stats for (default: 30)")
          .setMinValue(1)
          .setMaxValue(365),
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "chat") {
    const model = interaction.options.getString("model", true);
    const prompt = interaction.options.getString("prompt", true);
    const provider = providers.openai; // For now, hardcoded to OpenAI

    try {
      await interaction.deferReply();

      const result = await provider.complete(prompt, { model });

      // Record usage statistics
      await llmStats.recordUsage(
        interaction.user.id,
        provider.name,
        model,
        result.usage,
      );

      await interaction.editReply({
        content: result.content,
      });
    } catch (error) {
      console.error("Error in LLM chat:", error);
      await interaction.editReply({
        content: "Sorry, there was an error processing your request.",
      });
    }
  } else if (subcommand === "stats") {
    const days = interaction.options.getInteger("days") || 30;

    try {
      await interaction.deferReply();

      const stats = await llmStats.getStats(interaction.user.id, days);

      const embed = new EmbedBuilder()
        .setTitle("LLM Usage Statistics")
        .setDescription(`Statistics for the last ${days} days`)
        .addFields(
          {
            name: "Total Cost",
            value: `$${stats.totalCost.toFixed(4)}`,
            inline: true,
          },
          {
            name: "Total Tokens",
            value: stats.totalTokens.toString(),
            inline: true,
          },
        )
        .setFooter({ text: "Usage by Model:" });

      // Add usage breakdown by model
      Object.entries(stats.usageByModel).forEach(([model, usage]) => {
        embed.addFields({
          name: model,
          value: `Tokens: ${usage.tokens}\nCost: $${usage.cost.toFixed(4)}`,
          inline: true,
        });
      });

      await interaction.editReply({
        embeds: [embed],
      });
    } catch (error) {
      console.error("Error getting LLM stats:", error);
      await interaction.editReply({
        content: "Sorry, there was an error retrieving your statistics.",
      });
    }
  }
}
