import type { AIProvider, EnhancementOptions, EnhancementResult } from '../../shared/types';
import { OpenAIProviderWithChat } from './openai-chat-provider';
import { OpenRouterProvider } from './openrouter';
import { AnthropicProviderWithChat } from './anthropic-chat-provider';
import { OllamaProvider } from './ollama';
import ConfigManager from '../services/config-manager';

const providerInstances: AIProvider[] = [
  new OpenAIProviderWithChat(),
  new OpenRouterProvider(),
  new AnthropicProviderWithChat(),
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
    
    if (ordered.length === 0) {
      throw new Error('No configured providers available. Please add and enable at least one AI provider in Settings.');
    }

    const errors: Array<{ provider: string; error: Error; timestamp: number }> = [];
    const startTime = Date.now();

    for (const name of ordered) {
      const provider = this.providers.get(name);
      if (!provider) {
        errors.push({
          provider: name,
          error: new Error('Provider not found'),
          timestamp: Date.now(),
        });
        continue;
      }

      const key = ConfigManager.getProviderApiKey(name);
      if (name !== 'Ollama (Local)' && !key) {
        errors.push({
          provider: name,
          error: new Error('API key not configured'),
          timestamp: Date.now(),
        });
        continue;
      }

      try {
        // Configure provider
        if (name === 'Ollama (Local)') {
          (provider as unknown as OllamaProvider).configure('');
        } else {
          (provider as unknown as { configure(apiKey: string, model?: string): void }).configure(
            key,
            config.find((c) => c.name === name)?.model
          );
        }

        if (!provider.isConfigured()) {
          errors.push({
            provider: name,
            error: new Error('Provider not properly configured'),
            timestamp: Date.now(),
          });
          continue;
        }

        // Attempt enhancement with timeout
        const result = await Promise.race([
          provider.enhance(text, options),
          new Promise<EnhancementResult>((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), 60000)
          ),
        ]);

        // Success - return result with error context for logging
        if (errors.length > 0) {
          console.warn('Enhancement succeeded after fallback attempts:', {
            successfulProvider: name,
            failedProviders: errors.map((e) => e.provider),
            textLength: text.length,
            enhancementType: options.type,
          });
        }

        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        errors.push({
          provider: name,
          error,
          timestamp: Date.now(),
        });

        // Log error for debugging
        console.warn(`Provider ${name} failed:`, {
          error: error.message,
          textLength: text.length,
          enhancementType: options.type,
        });

        // Continue to next provider
        continue;
      }
    }

    // All providers failed - throw comprehensive error
    const processingTime = Date.now() - startTime;
    const errorMessages = errors.map((e) => `${e.provider}: ${e.error.message}`).join('; ');
    
    const finalError = new Error(
      `All ${ordered.length} provider(s) failed. ${errorMessages}`
    ) as Error & {
      code?: string;
      errors?: Array<{ provider: string; error: string; timestamp: number }>;
      textLength?: number;
      enhancementType?: string;
      processingTime?: number;
    };

    finalError.code = 'ALL_PROVIDERS_FAILED';
    finalError.errors = errors.map((e) => ({
      provider: e.provider,
      error: e.error.message,
      timestamp: e.timestamp,
    }));
    finalError.textLength = text.length;
    finalError.enhancementType = options.type;
    finalError.processingTime = processingTime;

    throw finalError;
  }
}

const ProviderManager = new ProviderManagerClass();
export default ProviderManager;
