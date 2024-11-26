import OpenAI from "openai";
import { LLMConfig, LLMProvider, LLMUsageStats } from "../../../types/llm";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Cost per 1M tokens
interface TokenRates {
  input: number;
  output: number;
}

const MODEL_RATES: Record<string, TokenRates> = {
  "gpt-4o": {
    input: 2.50,   // per 1M input tokens
    output: 10.00  // per 1M output tokens
  },
  "gpt-4o-mini": {
    input: 0.15,
    output: 0.60
  },
  "gpt-3.5-turbo-0613": {
    input: 1.50,
    output: 2.00
  }
};

const getDefaultConfig = (): LLMConfig => ({
  model: "gpt-4o-mini",
  temperature: 0.7,
  maxTokens: 500,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
});

const calculateCost = (model: string, promptTokens: number, completionTokens: number): number => {
  const rates = MODEL_RATES[model] || MODEL_RATES["gpt-4o-mini"];
  return (
    (promptTokens * rates.input / 1_000_000) +     // Input tokens cost
    (completionTokens * rates.output / 1_000_000)   // Output tokens cost
  );
};

export const complete = async (
  prompt: string,
  config?: Partial<LLMConfig>,
): Promise<{ content: string; usage: LLMUsageStats }> => {
  const finalConfig = { ...getDefaultConfig(), ...config };

  // Generic LLM Chat prompt (from Claude Haiku)
  // https://docs.anthropic.com/en/release-notes/system-prompts#oct-22nd-2024
  const systemPrompt = `The assistant is Cooper Bot. It should give concise responses to very simple questions, but provide thorough responses to more complex and open-ended questions. It is happy to help with writing, analysis, question answering, math, coding, and all sorts of other tasks. It uses markdown for coding. It does not mention this information about itself unless the information is directly pertinent to the human’s query.`;

  const response = await client.chat.completions.create({
    model: finalConfig.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    temperature: finalConfig.temperature,
    max_tokens: finalConfig.maxTokens,
    top_p: finalConfig.topP,
    frequency_penalty: finalConfig.frequencyPenalty,
    presence_penalty: finalConfig.presencePenalty,
  });

  const usage: LLMUsageStats = {
    promptTokens: response.usage?.prompt_tokens || 0,
    completionTokens: response.usage?.completion_tokens || 0,
    totalTokens: response.usage?.total_tokens || 0,
    estimatedCost: calculateCost(
      finalConfig.model,
      response.usage?.prompt_tokens || 0,
      response.usage?.completion_tokens || 0
    )
  };

  return {
    content: response.choices[0]?.message?.content || "No response generated.",
    usage,
  };
};

export const openaiProvider: LLMProvider = {
  name: "OpenAI",
  availableModels: ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo-0613"],
  getDefaultConfig,
  complete,
};
