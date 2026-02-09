import type { AppConfig, ProviderConfig } from './types';

export const DEFAULT_SHORTCUT = 'CommandOrControl+Shift+Space';

export const ENHANCEMENT_TYPES = [
  'grammar',
  'rephrase',
  'formal',
  'casual',
  'concise',
  'expand',
] as const;

export const PROVIDER_NAMES = ['OpenAI', 'OpenRouter', 'Anthropic', 'Ollama (Local)'] as const;

const defaultProviders: ProviderConfig[] = [
  { name: 'OpenAI', apiKey: '', model: 'gpt-4-turbo-preview', enabled: false, priority: 1 },
  { name: 'OpenRouter', apiKey: '', model: 'anthropic/claude-3-sonnet', enabled: false, priority: 2 },
  { name: 'Anthropic', apiKey: '', model: 'claude-3-sonnet-20240229', enabled: false, priority: 3 },
  { name: 'Ollama (Local)', apiKey: '', model: 'llama2', enabled: false, priority: 4 },
];

export const DEFAULT_APP_CONFIG: AppConfig = {
  providers: defaultProviders,
  shortcut: DEFAULT_SHORTCUT,
  theme: 'system',
  defaultEnhancementType: 'rephrase',
  showMultipleSuggestions: true,
  enableHistory: true,
  startAtLogin: false,
  excludedApps: [],
};
