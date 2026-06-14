/**
 * Purpose:
 * AI Provider interface definition.
 * All AI providers must implement this interface.
 * Business logic depends on this interface only, never on concrete implementations.
 *
 * Responsibilities:
 * - Define the contract for AI text generation
 * - Enable provider swapping without changing business logic
 *
 * Dependencies:
 * - None (interface-only, zero runtime dependencies)
 */

export interface GenerateTextInput {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

export interface GenerateTextOutput {
  text: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AIProvider {
  /**
   * Generate text from the AI model.
   */
  generateText(input: GenerateTextInput): Promise<GenerateTextOutput>;

  /**
   * Human-readable provider name for logging and cost tracking.
   */
  readonly providerName: string;
}
