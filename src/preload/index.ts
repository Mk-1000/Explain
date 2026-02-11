import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (config: unknown) => ipcRenderer.invoke('config:set', config),
  getProviders: () => ipcRenderer.invoke('config:get-providers'),
  saveProvider: (name: string, config: unknown) =>
    ipcRenderer.invoke('config:save-provider', name, config),
  getShortcut: () => ipcRenderer.invoke('config:get-shortcut'),
  setShortcut: (shortcut: string) => ipcRenderer.invoke('config:set-shortcut', shortcut),
  enhanceText: (text: string, options: unknown) =>
    ipcRenderer.invoke('ai:enhance', text, options),
  testProvider: (providerName: string) =>
    ipcRenderer.invoke('ai:test-provider', providerName),
  getAvailableProviders: () => ipcRenderer.invoke('ai:get-providers'),
  getExcludedApps: () => ipcRenderer.invoke('privacy:get-excluded-apps'),
  addExcludedApp: (appName: string) =>
    ipcRenderer.invoke('privacy:add-excluded-app', appName),
  removeExcludedApp: (appName: string) =>
    ipcRenderer.invoke('privacy:remove-excluded-app', appName),
  closePopup: () => ipcRenderer.invoke('window:close-popup'),
  showSettings: () => ipcRenderer.invoke('window:show-settings'),
  closeWindow: () => ipcRenderer.send('window:close'),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  writeClipboard: (text: string) => ipcRenderer.invoke('clipboard:write', text),
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
  writeAndPaste: (text: string) => ipcRenderer.invoke('clipboard:write-and-paste', text),
  onTextSelected: (callback: (data: { text: string; timestamp: number }) => void) => {
    ipcRenderer.on('text-selected', (_event, data) => callback(data));
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
  getHistory: () => ipcRenderer.invoke('history:get'),
  searchHistory: (query: string) => ipcRenderer.invoke('history:search', query),
  filterHistory: (filters: { type?: string; provider?: string; dateFrom?: number; dateTo?: number; favorite?: boolean }) =>
    ipcRenderer.invoke('history:filter', filters),
  addHistory: (item: { original: string; enhanced: string; type: string; provider: string; processingTime?: number; tokensUsed?: number }) =>
    ipcRenderer.invoke('history:add', item),
  updateHistory: (id: string, updates: unknown) => ipcRenderer.invoke('history:update', id, updates),
  deleteHistory: (id: string) => ipcRenderer.invoke('history:delete', id),
  toggleFavorite: (id: string) => ipcRenderer.invoke('history:toggle-favorite', id),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  getHistoryStats: () => ipcRenderer.invoke('history:get-stats'),
  exportHistory: (format: 'json' | 'csv') => ipcRenderer.invoke('history:export', format),
  updateAutoLaunch: (enabled: boolean) => ipcRenderer.invoke('config:update-auto-launch', enabled),
  
  // Chat-specific APIs
  chat: {
    sendMessage: (request: {
      message: string;
      conversationHistory: Array<{
        id: string;
        role: 'user' | 'assistant' | 'system';
        content: string;
        timestamp: number;
      }>;
      useContext: boolean;
    }) => ipcRenderer.invoke('chat:send-message', request),
    getConfig: () => ipcRenderer.invoke('chat:get-config'),
    updateConfig: (config: {
      responseStyle?: 'concise' | 'balanced' | 'detailed';
      tone?: 'professional' | 'casual' | 'technical' | 'friendly';
      creativity?: 'low' | 'medium' | 'high';
      contextAwareness?: boolean;
      maxTokens?: number;
      temperature?: number;
    }) => ipcRenderer.invoke('chat:update-config', config),
    clearHistory: () => ipcRenderer.invoke('chat:clear-history'),
    exportConversation: (messages: Array<{
      id: string;
      role: 'user' | 'assistant' | 'system';
      content: string;
      timestamp: number;
    }>) => ipcRenderer.invoke('chat:export-conversation', messages),
    saveConversation: (conversation: {
      id: string;
      title: string;
      messages: Array<{
        id: string;
        role: 'user' | 'assistant' | 'system';
        content: string;
        timestamp: number;
      }>;
      created: number;
      updated: number;
      tags: string[];
    }) => ipcRenderer.invoke('chat:save-conversation', conversation),
    getHistory: () => ipcRenderer.invoke('chat:get-history'),
    deleteConversation: (id: string) => ipcRenderer.invoke('chat:delete-conversation', id),
    clearAllHistory: () => ipcRenderer.invoke('chat:clear-all-history'),
    getProviders: () => ipcRenderer.invoke('chat:get-providers'),
  },

  // Event listeners for chat
  onChatConfigUpdated: (callback: (config: {
    responseStyle: 'concise' | 'balanced' | 'detailed';
    tone: 'professional' | 'casual' | 'technical' | 'friendly';
    creativity: 'low' | 'medium' | 'high';
    contextAwareness: boolean;
    maxTokens: number;
    temperature: number;
  }) => void) => {
    const subscription = (_event: any, config: any) => callback(config);
    ipcRenderer.on('chat-config-updated', subscription);
    return () => ipcRenderer.removeListener('chat-config-updated', subscription);
  },

  onChatInitialized: (
    callback: (data: {
      config: {
        responseStyle: 'concise' | 'balanced' | 'detailed';
        tone: 'professional' | 'casual' | 'technical' | 'friendly';
        creativity: 'low' | 'medium' | 'high';
        contextAwareness: boolean;
        maxTokens: number;
        temperature: number;
      };
      initialText: string;
    }) => void
  ) => {
    const subscription = (_event: any, data: any) => callback(data);
    ipcRenderer.on('chat-initialized', subscription);
    return () => ipcRenderer.removeListener('chat-initialized', subscription);
  },

});
