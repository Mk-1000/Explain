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
  // New fields
  originalLength: number;
  enhancedLength: number;
  processingTime?: number;
  tokensUsed?: number;
  tags?: string[];
  favorite?: boolean;
  notes?: string;
}

export interface HistoryStats {
  totalEnhancements: number;
  totalCharactersProcessed: number;
  averageProcessingTime: number;
  mostUsedType: string;
  mostUsedProvider: string;
  enhancementsByType: Record<string, number>;
  enhancementsByProvider: Record<string, number>;
  enhancementsByDate: Record<string, number>;
}

export interface ChatConfig {
  responseStyle: 'concise' | 'balanced' | 'detailed';
  tone: 'professional' | 'casual' | 'technical' | 'friendly';
  creativity: 'low' | 'medium' | 'high';
  contextAwareness: boolean;
  maxTokens: number;
  temperature: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  created: number;
  updated: number;
  tags: string[];
}

export interface TextCaptureResult {
  text: string;
  capturedFrom: 'selection' | 'clipboard' | 'fallback' | 'none';
  copySimulated: boolean;
  platformToolAvailable: boolean;
  captureMethod?: 'robotjs' | 'native-clipboard' | 'system-command' | 'xdotool' | 'wtype' | 'osascript' | 'powershell';
  attemptCount?: number;
  totalDuration?: number;
  error?: string;
}

export interface PlatformCapabilities {
  hasRobotJS: boolean;
  hasNativeSelection: boolean;
  platform: NodeJS.Platform;
  recommendedMethod: 'robotjs' | 'clipboard-only' | 'system-command';
  hasXdotool?: boolean;
  hasWtype?: boolean;
  hasXclip?: boolean;
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  clipboardCheckIntervalMs: number;
}
