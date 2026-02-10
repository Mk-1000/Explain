import { ipcMain, clipboard, app } from 'electron';
import path from 'path';
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
    
    // Enhanced validation with better error messages
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return {
        error: 'No text selected. Please select some text and try again.',
        code: 'NO_TEXT_SELECTED',
        userAction: 'Select text before pressing the shortcut key',
        textLength: 0,
        processingTime: Date.now() - startTime,
      };
    }
    
    // Check text length limits
    if (text.length > 10000) {
      return {
        error: 'Selected text is too long (maximum 10,000 characters).',
        code: 'TEXT_TOO_LONG',
        userAction: 'Select a shorter portion of text',
        textLength: text.length,
        processingTime: Date.now() - startTime,
      };
    }

    // Check for sensitive data
    if (PrivacyManager.containsSensitiveData(text)) {
      return {
        error: 'Text contains sensitive information (credit cards, SSN, etc.).',
        code: 'SENSITIVE_DATA',
        userAction: 'Remove sensitive data from the selection',
        textLength: text.length,
        processingTime: Date.now() - startTime,
      };
    }

    try {
      const result = await ProviderManager.enhanceWithFallback(text, options as unknown as EnhancementOptions);
      return result;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      
      // Enhanced error response
      const errorResponse = {
        error: error.message,
        code: (error as { code?: string }).code || 'ENHANCEMENT_FAILED',
        userAction: getUserActionForError(error),
        troubleshooting: getTroubleshootingSteps(error),
        textLength: text.length,
        enhancementType: options.type as string,
        processingTime: Date.now() - startTime,
      };
      
      // Include provider-specific errors if available
      const errorWithDetails = error as unknown as { errors?: Array<{ provider: string; error: string }> };
      if (errorWithDetails.errors) {
        (errorResponse as { errors?: Array<{ provider: string; error: string }> }).errors = errorWithDetails.errors;
      }
      
      console.error('Enhancement failed:', errorResponse);
      return errorResponse;
    }
  });
  
  // Helper functions for error handling
  function getUserActionForError(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('api key')) {
      return 'Check your API key in Settings';
    }
    if (message.includes('rate limit')) {
      return 'Wait a moment and try again (rate limit reached)';
    }
    if (message.includes('network') || message.includes('timeout')) {
      return 'Check your internet connection';
    }
    if (message.includes('unauthorized')) {
      return 'Verify your API credentials in Settings';
    }
    
    return 'Try again or check Settings';
  }
  
  function getTroubleshootingSteps(error: Error): string[] {
    const steps: string[] = [];
    const message = error.message.toLowerCase();
    
    if (message.includes('api key')) {
      steps.push('Go to Settings > AI Providers');
      steps.push('Verify your API key is correct');
      steps.push('Test the connection using the Test button');
    }
    
    if (message.includes('ollama')) {
      steps.push('Ensure Ollama is running (ollama serve)');
      steps.push('Check that the model is installed (ollama list)');
      steps.push('Verify Ollama is accessible at http://localhost:11434');
    }
    
    if (message.includes('network')) {
      steps.push('Check your internet connection');
      steps.push('Verify firewall settings');
      steps.push('Try using a different provider');
    }
    
    return steps;
  }

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
  
  ipcMain.handle('history:search', (_event, query: string) => 
    ConfigManager.searchHistory(query)
  );
  
  ipcMain.handle('history:filter', (_event, filters) => 
    ConfigManager.filterHistory(filters)
  );
  
  ipcMain.handle('history:add', (_event, item: { original: string; enhanced: string; type: string; provider: string; processingTime?: number; tokensUsed?: number }) => {
    ConfigManager.addToHistory({
      ...item,
      timestamp: Date.now(),
    });
    return true;
  });
  
  ipcMain.handle('history:update', (_event, id: string, updates) => {
    ConfigManager.updateHistoryItem(id, updates);
    return true;
  });
  
  ipcMain.handle('history:delete', (_event, id: string) => {
    ConfigManager.deleteHistoryItem(id);
    return true;
  });
  
  ipcMain.handle('history:toggle-favorite', (_event, id: string) => {
    ConfigManager.toggleFavorite(id);
    return true;
  });
  
  ipcMain.handle('history:clear', () => {
    ConfigManager.clearHistory();
    return true;
  });
  
  ipcMain.handle('history:get-stats', () => 
    ConfigManager.getHistoryStats()
  );
  
  ipcMain.handle('history:export', async (_event, format: 'json' | 'csv') => {
    const { dialog } = require('electron');
    const fs = require('fs');
    const data = ConfigManager.exportHistory(format);
    const filename = `writeup-history-${Date.now()}.${format}`;
    
    return dialog.showSaveDialog({
      title: 'Export History',
      defaultPath: path.join(app.getPath('downloads'), filename),
      filters: [
        format === 'json' 
          ? { name: 'JSON', extensions: ['json'] }
          : { name: 'CSV', extensions: ['csv'] }
      ]
    }).then((result: { canceled: boolean; filePath?: string }) => {
      if (!result.canceled && result.filePath) {
        fs.writeFileSync(result.filePath, data, 'utf8');
        return { success: true, path: result.filePath };
      }
      return { success: false };
    });
  });
  
  ipcMain.handle('config:update-auto-launch', (_event, enabled: boolean) => {
    if (app.setLoginItemSettings) {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        openAsHidden: true,
        path: process.execPath,
        args: ['--hidden']
      });
    }
    return true;
  });
}
