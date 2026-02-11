import Store from 'electron-store';
import type { AppConfig, ProviderConfig, HistoryItem, HistoryStats, ChatConfig, ChatConversation } from '../../shared/types';
import { DEFAULT_APP_CONFIG, DEFAULT_CHAT_CONFIG } from '../../shared/constants';

interface StoreSchema {
  config: AppConfig;
  history: HistoryItem[];
  chatConfig: ChatConfig;
  chatHistory: ChatConversation[];
}

class ConfigManagerClass {
  private store = new Store<StoreSchema>({
    name: 'writeup-config',
    defaults: {
      config: DEFAULT_APP_CONFIG,
      history: [],
      chatConfig: DEFAULT_CHAT_CONFIG,
      chatHistory: [],
    },
  });

  getAll(): AppConfig {
    return this.store.get('config');
  }

  setAll(config: AppConfig): void {
    this.store.set('config', config);
  }

  getProviders(): ProviderConfig[] {
    return this.store.get('config.providers', DEFAULT_APP_CONFIG.providers);
  }

  updateProvider(name: string, config: Partial<ProviderConfig>): void {
    const configAll = this.store.get('config');
    const providers = [...configAll.providers];
    const idx = providers.findIndex((p) => p.name === name);
    
    // Check if priority is being changed to 1
    if (config.priority === 1 && idx >= 0) {
      const currentProvider = providers[idx];
      const oldPriority = currentProvider.priority;
      
      // Only reorder if the priority is actually changing to 1
      if (oldPriority !== 1) {
        // Shift all providers with priority <= oldPriority up by 1
        providers.forEach((p, i) => {
          if (i !== idx && p.priority <= oldPriority && p.priority >= 1) {
            p.priority = p.priority + 1;
          }
        });
      }
    }
    
    if (idx >= 0) {
      providers[idx] = { ...providers[idx], ...config };
    } else {
      const defaults = DEFAULT_APP_CONFIG.providers.find((p) => p.name === name);
      providers.push({
        ...(defaults ?? {
          name,
          apiKey: '',
          model: '',
          enabled: false,
          priority: providers.length + 1,
        }),
        ...config,
        name,
      });
    }
    this.store.set('config.providers', providers);
  }

  getProviderApiKey(name: string): string {
    const providers = this.getProviders();
    const p = providers.find((x) => x.name === name);
    return p?.apiKey ?? '';
  }

  getShortcut(): string {
    return this.store.get('config.shortcut', DEFAULT_APP_CONFIG.shortcut);
  }

  setShortcut(shortcut: string): void {
    this.store.set('config.shortcut', shortcut);
  }

  getHistory(): HistoryItem[] {
    return this.store.get('history', []);
  }

  addToHistory(item: Omit<HistoryItem, 'id' | 'originalLength' | 'enhancedLength' | 'tags' | 'favorite'>): void {
    const history = this.store.get('history', []);
    
    const newItem: HistoryItem = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      originalLength: item.original.length,
      enhancedLength: item.enhanced.length,
      favorite: false,
      tags: this.autoGenerateTags(item),
    };
    
    // Keep last 1000 items instead of 100
    const updated = [newItem, ...history].slice(0, 1000);
    this.store.set('history', updated);
  }
  
  searchHistory(query: string): HistoryItem[] {
    const history = this.getHistory();
    const lowerQuery = query.toLowerCase();
    
    return history.filter(item =>
      item.original.toLowerCase().includes(lowerQuery) ||
      item.enhanced.toLowerCase().includes(lowerQuery) ||
      item.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }
  
  filterHistory(filters: {
    type?: string;
    provider?: string;
    dateFrom?: number;
    dateTo?: number;
    favorite?: boolean;
  }): HistoryItem[] {
    let history = this.getHistory();
    
    if (filters.type) {
      history = history.filter(item => item.type === filters.type);
    }
    
    if (filters.provider) {
      history = history.filter(item => item.provider === filters.provider);
    }
    
    if (filters.dateFrom) {
      history = history.filter(item => item.timestamp >= filters.dateFrom!);
    }
    
    if (filters.dateTo) {
      history = history.filter(item => item.timestamp <= filters.dateTo!);
    }
    
    if (filters.favorite !== undefined) {
      history = history.filter(item => item.favorite === filters.favorite);
    }
    
    return history;
  }
  
  toggleFavorite(id: string): void {
    const history = this.getHistory();
    const item = history.find(h => h.id === id);
    
    if (item) {
      item.favorite = !item.favorite;
      this.store.set('history', history);
    }
  }
  
  updateHistoryItem(id: string, updates: Partial<HistoryItem>): void {
    const history = this.getHistory();
    const index = history.findIndex(h => h.id === id);
    
    if (index >= 0) {
      history[index] = { ...history[index], ...updates };
      this.store.set('history', history);
    }
  }
  
  deleteHistoryItem(id: string): void {
    const history = this.getHistory();
    const updated = history.filter(h => h.id !== id);
    this.store.set('history', updated);
  }
  
  getHistoryStats(): HistoryStats {
    const history = this.getHistory();
    
    const stats: HistoryStats = {
      totalEnhancements: history.length,
      totalCharactersProcessed: history.reduce((sum, item) => 
        sum + item.originalLength, 0),
      averageProcessingTime: history.reduce((sum, item) => 
        sum + (item.processingTime || 0), 0) / (history.length || 1),
      mostUsedType: '',
      mostUsedProvider: '',
      enhancementsByType: {},
      enhancementsByProvider: {},
      enhancementsByDate: {},
    };
    
    // Calculate aggregations
    history.forEach(item => {
      // By type
      stats.enhancementsByType[item.type] = 
        (stats.enhancementsByType[item.type] || 0) + 1;
      
      // By provider
      stats.enhancementsByProvider[item.provider] = 
        (stats.enhancementsByProvider[item.provider] || 0) + 1;
      
      // By date
      const date = new Date(item.timestamp).toISOString().split('T')[0];
      stats.enhancementsByDate[date] = 
        (stats.enhancementsByDate[date] || 0) + 1;
    });
    
    // Find most used
    stats.mostUsedType = Object.entries(stats.enhancementsByType)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || '';
    
    stats.mostUsedProvider = Object.entries(stats.enhancementsByProvider)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || '';
    
    return stats;
  }
  
  exportHistory(format: 'json' | 'csv' = 'json'): string {
    const history = this.getHistory();
    
    if (format === 'json') {
      return JSON.stringify(history, null, 2);
    }
    
    // CSV format
    const headers = [
      'Timestamp',
      'Type',
      'Provider',
      'Original',
      'Enhanced',
      'Original Length',
      'Enhanced Length',
      'Processing Time',
    ].join(',');
    
    const rows = history.map(item => [
      new Date(item.timestamp).toISOString(),
      item.type,
      item.provider,
      `"${item.original.replace(/"/g, '""')}"`,
      `"${item.enhanced.replace(/"/g, '""')}"`,
      item.originalLength,
      item.enhancedLength,
      item.processingTime || '',
    ].join(','));
    
    return [headers, ...rows].join('\n');
  }
  
  private autoGenerateTags(item: { type: string; provider: string; original: string }): string[] {
    const tags: string[] = [item.type, item.provider];
    
    // Add length-based tags
    if (item.original.length < 50) tags.push('short');
    else if (item.original.length < 200) tags.push('medium');
    else tags.push('long');
    
    // Add content-based tags
    if (/\b(email|e-mail)\b/i.test(item.original)) tags.push('email');
    if (/\b(meeting|schedule|calendar)\b/i.test(item.original)) tags.push('meeting');
    if (/\b(code|function|class|const|let|var)\b/i.test(item.original)) tags.push('code');
    if (/\?\s*$/.test(item.original)) tags.push('question');
    
    return tags;
  }

  clearHistory(): void {
    this.store.set('history', []);
  }

  // Chat configuration persistence
  getChatConfig(): ChatConfig {
    return this.store.get('chatConfig', DEFAULT_CHAT_CONFIG);
  }

  setChatConfig(config: Partial<ChatConfig>): void {
    const current = this.getChatConfig();
    this.store.set('chatConfig', { ...current, ...config });
  }

  // Chat history persistence
  getChatHistory(): ChatConversation[] {
    return this.store.get('chatHistory', []);
  }

  saveChatConversation(conversation: ChatConversation): void {
    const history = this.getChatHistory();
    const existing = history.findIndex(c => c.id === conversation.id);
    
    if (existing >= 0) {
      history[existing] = { ...conversation, updated: Date.now() };
    } else {
      history.unshift(conversation);
    }
    
    // Keep last 50 conversations
    this.store.set('chatHistory', history.slice(0, 50));
  }

  deleteChatConversation(id: string): void {
    const history = this.getChatHistory();
    const updated = history.filter(c => c.id !== id);
    this.store.set('chatHistory', updated);
  }

  clearChatHistory(): void {
    this.store.set('chatHistory', []);
  }
}

const ConfigManager = new ConfigManagerClass();
export default ConfigManager;
