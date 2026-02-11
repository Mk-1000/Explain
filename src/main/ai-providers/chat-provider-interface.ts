import type { AIProvider } from '../../shared/types';

/**
 * Extended AI provider interface that supports chat functionality
 */
export interface ChatAIProvider extends AIProvider {
  /**
   * Enhanced chat completion method with configurable parameters
   */
  enhanceChat(
    messages: Array<{ role: string; content: string }>,
    options: ChatEnhanceOptions
  ): Promise<ChatEnhanceResult>;
}

export interface ChatEnhanceOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stream?: boolean;
}

export interface ChatEnhanceResult {
  text: string;
  tokensUsed?: number;
  finishReason?: 'stop' | 'length' | 'content_filter';
  model?: string;
}

/**
 * Check if a provider supports chat functionality
 */
export function isChatProvider(provider: AIProvider): provider is ChatAIProvider {
  return 'enhanceChat' in provider && typeof (provider as any).enhanceChat === 'function';
}
