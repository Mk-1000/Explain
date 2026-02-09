import type { AIProvider, EnhancementOptions, EnhancementResult } from '../../shared/types';
import { OpenAIProvider } from './openai';
import { OpenRouterProvider } from './openrouter';
import { AnthropicProvider } from './anthropic';
import { OllamaProvider } from './ollama';
import ConfigManager from '../services/config-manager';

const providerInstances: AIProvider[] = [
  new OpenAIProvider(),
  new OpenRouterProvider(),
  new AnthropicProvider(),
  new OllamaProvider(),
];

class ProviderManagerClass {
  private providers = new Map<string, AIProvider>();

  constructor() {
    providerInstances.forEach((p) => this.providers.set(p.name, p));
  }

  private applyConfig(): void {
    const config = ConfigManager.getProviders();
    for (const pc of config) {
      const p = this.providers.get(pc.name);
      if (!p) continue;
      if (p.name === 'Ollama (Local)') {
        (p as unknown as OllamaProvider).configure('', pc.model);
      } else {
        (p as unknown as { configure(apiKey: string, model?: string): void }).configure(
          pc.apiKey,
          pc.model
        );
      }
    }
  }

  getProvider(name: string): AIProvider | undefined {
    return this.providers.get(name);
  }

  getAllProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  getConfiguredProviders(): AIProvider[] {
    this.applyConfig();
    return this.getAllProviders().filter((p) => p.isConfigured());
  }

  async enhanceWithFallback(
    text: string,
    options: EnhancementOptions
  ): Promise<EnhancementResult> {
    this.applyConfig();
    const config = ConfigManager.getProviders();
    const ordered = config
      .filter(
        (c) =>
          c.enabled &&
          (c.name === 'Ollama (Local)' || (c.apiKey !== undefined && c.apiKey.length > 0))
      )
      .sort((a, b) => a.priority - b.priority)
      .map((c) => c.name);
    let lastError: Error | null = null;
    for (const name of ordered) {
      const provider = this.providers.get(name);
      if (!provider) continue;
      const key = ConfigManager.getProviderApiKey(name);
      if (name !== 'Ollama (Local)' && !key) continue;
      if (name === 'Ollama (Local)') {
        (provider as unknown as OllamaProvider).configure('');
      } else {
        (provider as unknown as { configure(apiKey: string, model?: string): void }).configure(
          key,
          config.find((c) => c.name === name)?.model
        );
      }
      if (!provider.isConfigured()) continue;
      try {
        return await provider.enhance(text, options);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
    throw lastError ?? new Error('No configured providers available');
  }
}

const ProviderManager = new ProviderManagerClass();
export default ProviderManager;
