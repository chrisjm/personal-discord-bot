import OpenAI from "openai";
import { ChatInputCommandInteraction } from "discord.js";
import { LLMConfig, LLMProvider, LLMUsageStats } from "../../../types/llm";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const getDefaultConfig = (): LLMConfig => ({
  model: "gpt-3.5-turbo",
  temperature: 0.7,
  maxTokens: 500,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
});

const complete = async (
  interaction: ChatInputCommandInteraction,
  prompt: string,
  config?: Partial<LLMConfig>
): Promise<{ content: string; usage: LLMUsageStats }> => {
  const finalConfig = { ...getDefaultConfig(), ...config };

  // Generic LLM Chat prompt (from Claude Haiku)
  // https://docs.anthropic.com/en/release-notes/system-prompts#oct-22nd-2024
  const systemPrompt = `The assistant is Cooper Bot. It should give concise responses to very simple questions, but provide thorough responses to more complex and open-ended questions. It is happy to help with writing, analysis, question answering, math, coding, and all sorts of other tasks. It uses markdown for coding. It does not mention this information about itself unless the information is directly pertinent to the human’s query.`;

  const response = await client.chat.completions.create({
    model: finalConfig.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt }],
    temperature: finalConfig.temperature,
    max_tokens: finalConfig.maxTokens,
    top_p: finalConfig.topP,
    frequency_penalty: finalConfig.frequencyPenalty,
    presence_penalty: finalConfig.presencePenalty,
  });

  // Calculate estimated cost based on model and tokens
  // These rates are approximate and may need adjustment
  const rates = {
    "gpt-4": { prompt: 0.03, completion: 0.06 },
    "gpt-3.5-turbo": { prompt: 0.001, completion: 0.002 },
  };
  const modelRates = rates[finalConfig.model as keyof typeof rates] || rates["gpt-3.5-turbo"];

  const usage: LLMUsageStats = {
    promptTokens: response.usage?.prompt_tokens || 0,
    completionTokens: response.usage?.completion_tokens || 0,
    totalTokens: response.usage?.total_tokens || 0,
    estimatedCost:
      (response.usage?.prompt_tokens || 0) * modelRates.prompt / 1000 +
      (response.usage?.completion_tokens || 0) * modelRates.completion / 1000,
  };

  return {
    content: response.choices[0]?.message?.content || "No response generated.",
    usage,
  };
};

export const openaiProvider: LLMProvider = {
  name: "OpenAI",
  availableModels: ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"],
  getDefaultConfig,
  complete,
};
