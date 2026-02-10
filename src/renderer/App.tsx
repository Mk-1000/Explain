/**
 * Main window app (quick-start-guide: renderer/App.tsx).
 * Renders the Settings panel for the main BrowserWindow.
 */
import { useEffect, useState } from 'react';
import Settings from './components/Settings';
import { useTheme } from './hooks/useTheme';
import type { AppConfig } from '@shared/types';
import { DEFAULT_APP_CONFIG } from '@shared/constants';

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        if (typeof window.electronAPI?.getConfig === 'function') {
          const loadedConfig = await window.electronAPI.getConfig();
          setConfig(loadedConfig ?? DEFAULT_APP_CONFIG);
        } else {
          setConfig(DEFAULT_APP_CONFIG);
        }
      } catch (err) {
        console.error('Failed to load config:', err);
        setConfig(DEFAULT_APP_CONFIG);
      }
    };
    loadConfig();
  }, []);

  useTheme(config);

  return <Settings />;
}
