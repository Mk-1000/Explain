import { ipcMain, clipboard } from 'electron';
import type { EnhancementOptions } from '../../shared/types';
import ConfigManager from '../services/config-manager';
import ProviderManager from '../ai-providers/provider-manager';
import PrivacyManager from '../services/privacy-manager';
import { OllamaProvider } from '../ai-providers/ollama';

export function registerIpcHandlers(
  closePopup: () => void,
  onShortcutChange?: () => void
): void {
  ipcMain.handle('config:get', () => ConfigManager.getAll());

  ipcMain.handle('config:set', (_event, config) => {
    ConfigManager.setAll(config);
    PrivacyManager.setExcludedApps(config.excludedApps ?? []);
    return true;
  });

  ipcMain.handle('config:get-providers', () => ConfigManager.getProviders());

  ipcMain.handle('config:save-provider', (_event, name: string, config: Record<string, unknown>) => {
    ConfigManager.updateProvider(name, config as Parameters<typeof ConfigManager.updateProvider>[1]);
    return true;
  });

  ipcMain.handle('config:get-shortcut', () => ConfigManager.getShortcut());

  ipcMain.handle('config:set-shortcut', (_event, shortcut: string) => {
    ConfigManager.setShortcut(shortcut);
    onShortcutChange?.();
    return true;
  });

  ipcMain.handle('ai:enhance', async (_event, text: string, options: Record<string, unknown>) => {
    if (PrivacyManager.containsSensitiveData(text)) {
      return { error: 'Text contains sensitive information', code: 'SENSITIVE_DATA' };
    }
    try {
      const result = await ProviderManager.enhanceWithFallback(text, options as unknown as EnhancementOptions);
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message, code: 'ENHANCEMENT_FAILED' };
    }
  });

  ipcMain.handle('ai:test-provider', async (_event, providerName: string) => {
    const provider = ProviderManager.getProvider(providerName);
    if (!provider) return { success: false, error: 'Provider not found' };
    const config = ConfigManager.getProviders().find((c) => c.name === providerName);
    if (providerName === 'Ollama (Local)') {
      (provider as unknown as OllamaProvider).configure('');
    } else if (config) {
      (provider as unknown as { configure(apiKey: string, model?: string): void }).configure(
        config.apiKey,
        config.model
      );
    }
    try {
      const isWorking = await provider.testConnection();
      return { success: isWorking };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('ai:get-providers', () => {
    const config = ConfigManager.getProviders();
    return ProviderManager.getAllProviders().map((p) => {
      const c = config.find((x) => x.name === p.name);
      const configured =
        p.name === 'Ollama (Local)'
          ? (c?.enabled ?? false)
          : !!(c?.apiKey && c.apiKey.length > 0);
      return { name: p.name, configured };
    });
  });

  ipcMain.handle('privacy:get-excluded-apps', () => {
    return ConfigManager.getAll().excludedApps ?? [];
  });

  ipcMain.handle('privacy:add-excluded-app', (_event, appName: string) => {
    const config = ConfigManager.getAll();
    const apps = [...(config.excludedApps ?? []), appName];
    ConfigManager.setAll({ ...config, excludedApps: apps });
    PrivacyManager.setExcludedApps(apps);
    return true;
  });

  ipcMain.handle('privacy:remove-excluded-app', (_event, appName: string) => {
    const config = ConfigManager.getAll();
    const apps = (config.excludedApps ?? []).filter((a) => a !== appName);
    ConfigManager.setAll({ ...config, excludedApps: apps });
    PrivacyManager.setExcludedApps(apps);
    return true;
  });

  ipcMain.handle('window:close-popup', () => {
    closePopup();
    return true;
  });

  ipcMain.handle('clipboard:write', (_event, text: string) => {
    clipboard.writeText(text);
    return true;
  });

  ipcMain.handle('clipboard:read', () => clipboard.readText());

  ipcMain.handle('clipboard:write-and-paste', (_event, text: string) => {
    clipboard.writeText(text);
    try {
      const robot = require('robotjs');
      const modifier = process.platform === 'darwin' ? 'command' : 'control';
      robot.keyTap('v', [modifier]);
    } catch {
      // ignore
    }
    closePopup();
    return true;
  });

  ipcMain.handle('history:get', () => ConfigManager.getHistory());
  ipcMain.handle('history:add', (_event, item: { original: string; enhanced: string; type: string; provider: string }) => {
    ConfigManager.addToHistory({
      ...item,
      timestamp: Date.now(),
    });
    return true;
  });
  ipcMain.handle('history:clear', () => {
    ConfigManager.clearHistory();
    return true;
  });
}
