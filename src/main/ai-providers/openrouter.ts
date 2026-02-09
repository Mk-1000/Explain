import axios from 'axios';
import type {
  AIProvider,
  EnhancementOptions,
  EnhancementResult,
  Suggestion,
} from '../../shared/types';

export class OpenRouterProvider implements AIProvider {
  name = 'OpenRouter';
  private apiKey = '';
  private model = 'anthropic/claude-3-sonnet';
  private baseURL = 'https://openrouter.ai/api/v1';

  configure(apiKey: string, model?: string): void {
    this.apiKey = apiKey;
    if (model) this.model = model;
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseURL}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async enhance(text: string, options: EnhancementOptions): Promise<EnhancementResult> {
    if (!this.apiKey) throw new Error('OpenRouter provider not configured');
    const startTime = Date.now();
    const systemPrompt = this.buildSystemPrompt(options);
    try {
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://text-enhancer.app',
            'X-Title': 'Text Enhancement App',
          },
        }
      );
      const content = (response.data?.choices?.[0]?.message?.content ?? '').trim();
      const suggestions: Suggestion[] = [
        { text: content, type: options.type, confidence: 0.95, changes: [] },
      ];
      return {
        original: text,
        suggestions,
        provider: this.name,
        tokensUsed: response.data?.usage?.total_tokens,
        processingTime: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`OpenRouter enhancement failed: ${msg}`);
    }
  }

  private buildSystemPrompt(options: EnhancementOptions): string {
    const prompts: Record<string, string> = {
      grammar: 'Fix grammar and spelling errors. Return only the corrected text.',
      rephrase: 'Improve clarity and readability. Return only the improved text.',
      formal: 'Rewrite in a formal, professional tone. Return only the rewritten text.',
      casual: 'Rewrite in a casual, friendly tone. Return only the rewritten text.',
      concise: 'Make more concise. Return only the concise version.',
      expand: 'Expand with more detail. Return only the expanded version.',
    };
    return prompts[options.type] ?? prompts.rephrase;
  }
}
