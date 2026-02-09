import { useState, useEffect, useCallback } from 'react';
import type { AppConfig } from '@shared/types';
import { DEFAULT_APP_CONFIG } from '@shared/constants';

export function useSettings() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      if (typeof window.electronAPI?.getConfig !== 'function') {
        setConfig(DEFAULT_APP_CONFIG);
        return;
      }
      const loadedConfig = await window.electronAPI.getConfig();
      setConfig(loadedConfig ?? DEFAULT_APP_CONFIG);
    } catch (err) {
      console.error('Failed to load settings:', err);
      setConfig(DEFAULT_APP_CONFIG);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSettings = useCallback(async (newConfig: AppConfig) => {
    try {
      await window.electronAPI.setConfig(newConfig);
      setConfig(newConfig);
      return true;
    } catch (err) {
      console.error('Failed to save settings:', err);
      return false;
    }
  }, []);

  const updateProvider = useCallback(
    async (name: string, providerConfig: Partial<{ apiKey: string; model: string; enabled: boolean; priority: number }>) => {
      try {
        await window.electronAPI.saveProvider(name, providerConfig);
        await loadSettings();
        return true;
      } catch (err) {
        console.error('Failed to update provider:', err);
        return false;
      }
    },
    [loadSettings]
  );

  const updateShortcut = useCallback(
    async (shortcut: string) => {
      try {
        await window.electronAPI.setShortcut(shortcut);
        if (config) setConfig({ ...config, shortcut });
        return true;
      } catch (err) {
        console.error('Failed to update shortcut:', err);
        return false;
      }
    },
    [config]
  );

  return {
    config,
    isLoading,
    saveSettings,
    updateProvider,
    updateShortcut,
    reload: loadSettings,
  };
}
