import Store from 'electron-store';
import type { AppConfig, ProviderConfig } from '../../shared/types';
import { DEFAULT_APP_CONFIG } from '../../shared/constants';

interface StoreSchema {
  config: AppConfig;
  history: Array<{ id: string; timestamp: number; original: string; enhanced: string; type: string; provider: string }>;
}

class ConfigManagerClass {
  private store = new Store<StoreSchema>({
    name: 'text-enhancer-config',
    defaults: {
      config: DEFAULT_APP_CONFIG,
      history: [],
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

  getHistory(): StoreSchema['history'] {
    return this.store.get('history', []);
  }

  addToHistory(item: Omit<StoreSchema['history'][0], 'id'>): void {
    const history = this.store.get('history', []);
    const newItem = { ...item, id: String(Date.now()) };
    const updated = [newItem, ...history].slice(0, 100);
    this.store.set('history', updated);
  }

  clearHistory(): void {
    this.store.set('history', []);
  }
}

const ConfigManager = new ConfigManagerClass();
export default ConfigManager;
