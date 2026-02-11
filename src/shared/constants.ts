import type { AppConfig, ProviderConfig, ChatConfig } from './types';

export const DEFAULT_SHORTCUT = 'CommandOrControl+Alt+E';

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
  { name: 'OpenAI', apiKey: '', model: 'gpt-4o-mini', enabled: false, priority: 1 },
  { name: 'OpenRouter', apiKey: '', model: 'openai/gpt-4o-mini', enabled: false, priority: 2 },
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
  startAtLogin: true,
  excludedApps: [],
};

export const DEFAULT_CHAT_CONFIG: ChatConfig = {
  responseStyle: 'balanced',
  tone: 'professional',
  creativity: 'medium',
  contextAwareness: true,
  maxTokens: 1000,
  temperature: 0.7,
};
