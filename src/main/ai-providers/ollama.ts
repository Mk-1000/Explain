import axios from 'axios';
import type {
  AIProvider,
  EnhancementOptions,
  EnhancementResult,
  Suggestion,
} from '../../shared/types';

export class OllamaProvider implements AIProvider {
  name = 'Ollama (Local)';
  private baseURL = 'http://localhost:11434';
  private model = 'llama2';

  configure(_apiKey: string, model?: string): void {
    if (model) this.model = model;
  }

  setBaseURL(url: string): void {
    this.baseURL = url;
  }

  isConfigured(): boolean {
    return true;
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseURL}/api/tags`, {
        timeout: 3000,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async enhance(text: string, options: EnhancementOptions): Promise<EnhancementResult> {
    const startTime = Date.now();
    const prompt = this.buildPrompt(text, options);
    try {
      const response = await axios.post(
        `${this.baseURL}/api/generate`,
        {
          model: this.model,
          prompt,
          stream: false,
          options: { temperature: 0.7, top_p: 0.9 },
        },
        { timeout: 30000 }
      );
      const content = (response.data?.response ?? '').trim();
      const suggestions: Suggestion[] = [
        { text: content, type: options.type, confidence: 0.85, changes: [] },
      ];
      return {
        original: text,
        suggestions,
        provider: this.name,
        processingTime: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Ollama enhancement failed: ${msg}`);
    }
  }

  private buildPrompt(text: string, options: EnhancementOptions): string {
    const instructions: Record<string, string> = {
      grammar:
        'Fix all grammar and spelling errors in the following text. Return only the corrected text:\n\n',
      rephrase:
        'Improve the following text for clarity and readability. Return only the improved version:\n\n',
      formal:
        'Rewrite the following text in a formal, professional tone. Return only the rewritten text:\n\n',
      casual:
        'Rewrite the following text in a casual, friendly tone. Return only the rewritten text:\n\n',
      concise:
        'Make the following text more concise. Return only the concise version:\n\n',
      expand:
        'Expand the following text with more details. Return only the expanded version:\n\n',
    };
    return (instructions[options.type] ?? instructions.rephrase) + text;
  }
}
