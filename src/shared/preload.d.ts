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
  onTextSelected: (callback: (data: { text: string; timestamp: number }) => void) => void;
  removeAllListeners: (channel: string) => void;
  getHistory: () => Promise<import('./types').HistoryItem[]>;
  addHistory: (item: { original: string; enhanced: string; type: string; provider: string }) => Promise<boolean>;
  clearHistory: () => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
