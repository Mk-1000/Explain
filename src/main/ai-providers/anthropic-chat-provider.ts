import Anthropic from '@anthropic-ai/sdk';
import type {
  AIProvider,
  EnhancementOptions,
  EnhancementResult,
  Suggestion,
} from '../../shared/types';
import type {
  ChatAIProvider,
  ChatEnhanceOptions,
  ChatEnhanceResult,
} from './chat-provider-interface';

export class AnthropicProviderWithChat implements AIProvider, ChatAIProvider {
  name = 'Anthropic';
  private client: Anthropic | null = null;
  private apiKey = '';
  private model = 'claude-sonnet-4-20250514';

  configure(apiKey: string, model?: string): void {
    this.apiKey = apiKey;
    if (model) this.model = model;
    this.client = new Anthropic({ apiKey: this.apiKey });
  }

  isConfigured(): boolean {
    return this.client !== null && this.apiKey.length > 0;
  }

  async testConnection(): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.client.messages.create({
        model: this.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }],
      });
      return true;
    } catch {
      return false;
    }
  }

  async enhance(text: string, options: EnhancementOptions): Promise<EnhancementResult> {
    if (!this.client) throw new Error('Anthropic provider not configured');
    const startTime = Date.now();
    const systemPrompt = this.buildSystemPrompt(options);

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: text }],
      });

      const content =
        response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
      const suggestions: Suggestion[] = [
        { text: content, type: options.type, confidence: 0.95, changes: [] },
      ];

      return {
        original: text,
        suggestions,
        provider: this.name,
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
        processingTime: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Anthropic enhancement failed: ${msg}`);
    }
  }

  /**
   * Enhanced chat completion method with configurable parameters
   */
  async enhanceChat(
    messages: Array<{ role: string; content: string }>,
    options: ChatEnhanceOptions = {}
  ): Promise<ChatEnhanceResult> {
    if (!this.client) throw new Error('Anthropic provider not configured');

    try {
      // Extract system message if present
      const systemMessage = messages.find((m) => m.role === 'system');
      const conversationMessages = messages.filter((m) => m.role !== 'system');

      // Convert messages to Anthropic format
      const anthropicMessages = conversationMessages.map((msg) => ({
        role: msg.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: msg.content,
      }));

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: options.maxTokens ?? 1000,
        temperature: options.temperature ?? 0.7,
        top_p: options.topP ?? 1,
        system: systemMessage?.content || undefined,
        messages: anthropicMessages,
      });

      const content = response.content[0]?.type === 'text' ? response.content[0].text : '';

      return {
        text: content.trim(),
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
        finishReason: response.stop_reason === 'end_turn' ? 'stop' : response.stop_reason === 'max_tokens' ? 'length' : undefined,
        model: this.model,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Anthropic chat enhancement failed: ${msg}`);
    }
  }

  private buildSystemPrompt(options: EnhancementOptions): string {
    const prompts: Record<string, string> = {
      grammar:
        "You are an expert grammar checker. Correct any grammar, spelling, or punctuation errors in the user's text. Return ONLY the corrected text with no explanations or additional commentary.",
      rephrase:
        "You are a professional writing assistant. Improve the clarity and flow of the user's text while preserving its meaning. Return ONLY the improved text.",
      formal:
        "Rewrite the user's text in a formal, professional tone appropriate for business or academic contexts. Return ONLY the rewritten text.",
      casual:
        "Rewrite the user's text in a casual, conversational tone. Return ONLY the rewritten text.",
      concise:
        "Make the user's text more concise while retaining all key information. Return ONLY the condensed text.",
      expand:
        "Expand the user's text with additional relevant details and context. Return ONLY the expanded text.",
    };
    return prompts[options.type] ?? prompts.rephrase;
  }
}
