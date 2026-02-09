export interface AIProvider {
  name: string;
  isConfigured(): boolean;
  enhance(text: string, options: EnhancementOptions): Promise<EnhancementResult>;
  testConnection(): Promise<boolean>;
}

export interface EnhancementOptions {
  type: 'grammar' | 'rephrase' | 'formal' | 'casual' | 'concise' | 'expand';
  language?: string;
  context?: string;
  maxVariants?: number;
}

export interface EnhancementResult {
  original: string;
  suggestions: Suggestion[];
  provider: string;
  tokensUsed?: number;
  processingTime: number;
}

export interface Suggestion {
  text: string;
  type: string;
  confidence: number;
  changes?: TextChange[];
}

export interface TextChange {
  type: 'addition' | 'deletion' | 'modification';
  original: string;
  replacement: string;
  position: number;
}

export interface ProviderConfig {
  name: string;
  apiKey: string;
  model: string;
  enabled: boolean;
  priority: number;
}

export interface AppConfig {
  providers: ProviderConfig[];
  shortcut: string;
  theme: 'light' | 'dark' | 'system';
  defaultEnhancementType: string;
  showMultipleSuggestions: boolean;
  enableHistory: boolean;
  startAtLogin: boolean;
  excludedApps: string[];
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  original: string;
  enhanced: string;
  type: string;
  provider: string;
}
