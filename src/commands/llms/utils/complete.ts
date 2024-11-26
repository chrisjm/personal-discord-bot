import { LLMConfig, LLMProvider, LLMUsageStats } from "../../../types/llm";
import { llmStats } from "./stats";

export interface CompletionResult {
  content: string;
  usage: LLMUsageStats;
  metadata?: Record<string, any>;
}

export interface CompletionOptions {
  config?: Partial<LLMConfig>;
  userId?: string;
  metadata?: Record<string, any>;
}

/**
 * General completion function that handles all LLM providers
 * Manages stats recording and provides a consistent interface
 */
export async function complete(
  prompt: string,
  provider: LLMProvider,
  options: CompletionOptions = {}
): Promise<CompletionResult> {
  try {
    // Get completion from provider
    const result = await provider.complete(prompt, options.config);

    // Record usage stats if userId is provided
    if (options.userId) {
      await llmStats.recordUsage(
        options.userId,
        provider.name,
        options.config?.model || provider.getDefaultConfig().model,
        result.usage
      );
    }

    return {
      content: result.content,
      usage: result.usage,
      metadata: options.metadata
    };
  } catch (error) {
    console.error('Error in LLM completion:', error);
    throw error;
  }
}
