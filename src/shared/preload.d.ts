export interface ElectronAPI {
  getConfig: () => Promise<import('./types').AppConfig>;
  setConfig: (config: import('./types').AppConfig) => Promise<boolean>;
  getProviders: () => Promise<import('./types').ProviderConfig[]>;
  saveProvider: (name: string, config: Partial<import('./types').ProviderConfig>) => Promise<boolean>;
  getShortcut: () => Promise<string>;
  setShortcut: (shortcut: string) => Promise<boolean>;
  enhanceText: (text: string, options: import('./types').EnhancementOptions) => Promise<import('./types').EnhancementResult | { error: string; code: string }>;
  testProvider: (providerName: string) => Promise<{ success: boolean; error?: string }>;
  getAvailableProviders: () => Promise<{ name: string; configured: boolean }[]>;
  getExcludedApps: () => Promise<string[]>;
  addExcludedApp: (appName: string) => Promise<boolean>;
  removeExcludedApp: (appName: string) => Promise<boolean>;
  closePopup: () => Promise<boolean>;
  showSettings: () => Promise<boolean>;
  writeClipboard: (text: string) => Promise<boolean>;
  readClipboard: () => Promise<string>;
  writeAndPaste: (text: string) => Promise<boolean>;
  onTextSelected: (callback: (data: { 
    text: string; 
    hasText: boolean;
    timestamp: number; 
    captureMetadata?: {
      capturedFrom: 'selection' | 'clipboard' | 'fallback' | 'none';
      copySimulated: boolean;
      captureMethod?: 'robotjs' | 'native-clipboard' | 'system-command' | 'xdotool' | 'wtype' | 'osascript' | 'powershell';
      attemptCount?: number;
      totalDuration?: number;
      platformToolAvailable: boolean;
      installInstructions?: string | null;
    };
  }) => void) => void;
  removeAllListeners: (channel: string) => void;
  getHistory: () => Promise<import('./types').HistoryItem[]>;
  searchHistory: (query: string) => Promise<import('./types').HistoryItem[]>;
  filterHistory: (filters: { type?: string; provider?: string; dateFrom?: number; dateTo?: number; favorite?: boolean }) => Promise<import('./types').HistoryItem[]>;
  addHistory: (item: { original: string; enhanced: string; type: string; provider: string; processingTime?: number; tokensUsed?: number }) => Promise<boolean>;
  updateHistory: (id: string, updates: Partial<import('./types').HistoryItem>) => Promise<boolean>;
  deleteHistory: (id: string) => Promise<boolean>;
  toggleFavorite: (id: string) => Promise<boolean>;
  clearHistory: () => Promise<boolean>;
  getHistoryStats: () => Promise<import('./types').HistoryStats>;
  exportHistory: (format: 'json' | 'csv') => Promise<{ success: boolean; path?: string }>;
  updateAutoLaunch: (enabled: boolean) => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
