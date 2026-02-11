import OpenAI from 'openai';
import type {
  AIProvider,
  EnhancementOptions,
  EnhancementResult,
  Suggestion,
  TextChange,
} from '../../shared/types';
import type {
  ChatAIProvider,
  ChatEnhanceOptions,
  ChatEnhanceResult,
} from './chat-provider-interface';

export class OpenAIProviderWithChat implements AIProvider, ChatAIProvider {
  name = 'OpenAI';
  private client: OpenAI | null = null;
  private apiKey = '';
  private model = 'gpt-4o-mini';

  configure(apiKey: string, model?: string): void {
    this.apiKey = apiKey;
    if (model) this.model = model;
    this.client = new OpenAI({ apiKey: this.apiKey });
  }

  isConfigured(): boolean {
    return this.client !== null && this.apiKey.length > 0;
  }

  async testConnection(): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5,
      });
      return true;
    } catch {
      return false;
    }
  }

  async enhance(text: string, options: EnhancementOptions): Promise<EnhancementResult> {
    if (!this.client) throw new Error('OpenAI provider not configured');
    const startTime = Date.now();
    const systemPrompt = this.buildSystemPrompt(options);
    const n = Math.min(options.maxVariants ?? 2, 3);
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0.7,
        max_tokens: 1000,
        n,
      });
      const suggestions: Suggestion[] = (response.choices || [])
        .filter((c) => c.message?.content)
        .map((choice, index) => ({
          text: (choice.message!.content as string).trim(),
          type: options.type,
          confidence: 1 - index * 0.15,
          changes: [] as TextChange[],
        }));
      return {
        original: text,
        suggestions,
        provider: this.name,
        tokensUsed: response.usage?.total_tokens,
        processingTime: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`OpenAI enhancement failed: ${msg}`);
    }
  }

  /**
   * Enhanced chat completion method with configurable parameters
   */
  async enhanceChat(
    messages: Array<{ role: string; content: string }>,
    options: ChatEnhanceOptions = {}
  ): Promise<ChatEnhanceResult> {
    if (!this.client) throw new Error('OpenAI provider not configured');

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1000,
        top_p: options.topP ?? 1,
        frequency_penalty: options.frequencyPenalty ?? 0,
        presence_penalty: options.presencePenalty ?? 0,
        stream: false,
      });

      const content = response.choices[0]?.message?.content || '';
      const finishReason = response.choices[0]?.finish_reason;

      return {
        text: content.trim(),
        tokensUsed: response.usage?.total_tokens,
        finishReason: finishReason as 'stop' | 'length' | 'content_filter' | undefined,
        model: this.model,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`OpenAI chat enhancement failed: ${msg}`);
    }
  }

  private buildSystemPrompt(options: EnhancementOptions): string {
    const prompts: Record<string, string> = {
      grammar:
        'You are a grammar and spelling correction expert. Fix errors while preserving the original meaning and style. Return only the corrected text without explanations.',
      rephrase:
        'You are a professional writing assistant. Rephrase the text to improve clarity and readability while maintaining the original meaning. Return only the rephrased text.',
      formal:
        'You are a professional writing assistant. Rewrite the text in a formal, professional tone suitable for business communication. Return only the rewritten text.',
      casual:
        'You are a friendly writing assistant. Rewrite the text in a casual, conversational tone. Return only the rewritten text.',
      concise:
        'You are an expert at concise communication. Make the text more concise and direct while preserving key information. Return only the concise version.',
      expand:
        'You are a writing assistant. Expand and elaborate on the text to provide more detail and context. Return only the expanded text.',
    };
    return prompts[options.type] ?? prompts.rephrase;
  }
}
