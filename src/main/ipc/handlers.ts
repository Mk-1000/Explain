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
    const startTime = Date.now();
    
    // Validate input
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return {
        error: 'Text is empty or invalid',
        code: 'INVALID_INPUT',
        textLength: 0,
        processingTime: Date.now() - startTime,
      };
    }

    // Check for sensitive data
    if (PrivacyManager.containsSensitiveData(text)) {
      return {
        error: 'Text contains sensitive information. Please remove emails, phone numbers, or other sensitive data.',
        code: 'SENSITIVE_DATA',
        textLength: text.length,
        processingTime: Date.now() - startTime,
      };
    }

    try {
      const result = await ProviderManager.enhanceWithFallback(text, options as unknown as EnhancementOptions);
      return result;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      const processingTime = Date.now() - startTime;

      // Extract detailed error information if available
      const errorResponse: {
        error: string;
        code: string;
        textLength?: number;
        enhancementType?: string;
        processingTime?: number;
        errors?: Array<{ provider: string; error: string }>;
      } = {
        error: error.message,
        code: (error as { code?: string }).code || 'ENHANCEMENT_FAILED',
        textLength: text.length,
        enhancementType: options.type as string,
        processingTime,
      };

      // Include provider-specific errors if available
      const errorWithDetails = error as unknown as { errors?: Array<{ provider: string; error: string }> };
      if (errorWithDetails.errors) {
        errorResponse.errors = errorWithDetails.errors;
      }

      // Log error for debugging
      console.error('Enhancement failed:', errorResponse);

      return errorResponse;
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
    // Write enhanced text to clipboard (always succeeds)
    clipboard.writeText(text);
    
    // Attempt to simulate paste using platform-specific native tools
    // Note: RobotJS has been removed for better cross-platform compatibility
    // Text is always available in clipboard for manual paste (Ctrl+V / Cmd+V)
    
    try {
      const { exec } = require('child_process');
      
      if (process.platform === 'linux') {
        // Try xdotool (common on Linux, but not required)
        exec('xdotool key ctrl+v', { timeout: 1000 }, () => {
          // Ignore errors - text is in clipboard regardless
        });
      } else if (process.platform === 'darwin') {
        // Use AppleScript for macOS
        exec('osascript -e \'tell application "System Events" to keystroke "v" using command down\'', 
          { timeout: 1000 }, () => {
          // Ignore errors - text is in clipboard regardless
        });
      } else if (process.platform === 'win32') {
        // Use PowerShell for Windows (requires System.Windows.Forms)
        exec('powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(\'^v\')"', 
          { timeout: 1000 }, () => {
          // Ignore errors - text is in clipboard regardless
        });
      }
    } catch (error) {
      // Graceful fallback: text is in clipboard, user can paste manually
      // This is expected on systems without the required tools
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
