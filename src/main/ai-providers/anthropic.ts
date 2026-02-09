import Anthropic from '@anthropic-ai/sdk';
import type {
  AIProvider,
  EnhancementOptions,
  EnhancementResult,
  Suggestion,
} from '../../shared/types';

export class AnthropicProvider implements AIProvider {
  name = 'Anthropic';
  private client: Anthropic | null = null;
  private apiKey = '';
  private model = 'claude-3-sonnet-20240229';

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
      const first = response.content?.[0];
      const content =
        first && 'text' in first ? (first as { text: string }).text : '';
      const suggestions: Suggestion[] = [
        { text: content.trim(), type: options.type, confidence: 0.95, changes: [] },
      ];
      return {
        original: text,
        suggestions,
        provider: this.name,
        tokensUsed:
          (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
        processingTime: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Anthropic enhancement failed: ${msg}`);
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
