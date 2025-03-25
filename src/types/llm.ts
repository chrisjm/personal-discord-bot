/**
 * Interface for LLM provider configuration
 */
export interface LLMConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

/**
 * Interface for LLM usage statistics
 */
export interface LLMUsageStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

/**
 * Interface for LLM provider functions
 */
export interface LLMProvider {
  name: string;
  availableModels: string[];
  getDefaultConfig: () => LLMConfig;
  complete: (
    prompt: string,
    config?: Partial<LLMConfig>,
  ) => Promise<{
    content: string;
    usage: LLMUsageStats;
  }>;
}
