import { useState, useEffect } from 'react';
import { useSettings } from '../../hooks/useSettings';
import { DEFAULT_SHORTCUT } from '@shared/constants';
import ProvidersTab from './ProvidersTab';
import ShortcutsTab from './ShortcutsTab';
import PreferencesTab from './PreferencesTab';
import HistoryList from '../History';
import './styles.css';

// Logo path - use correct path for dev and production
// In dev: Vite publicDir serves assets/ at root, so use /logo.png
// In production: assets are in dist/renderer/assets/, use ./assets/logo.png
const getLogoPath = () => {
  // Check if we're in development (Vite dev server)
  if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
    // Vite publicDir: 'assets' serves files at root, so assets/logo.png -> /logo.png
    return '/logo.png';
  }
  // Production: use relative path from HTML file location
  return './assets/logo.png';
};

const LOGO_PATH = getLogoPath();

type TabId = 'providers' | 'shortcuts' | 'preferences' | 'history';

/**
 * Settings panel (quick-start-guide: components/Settings/index.tsx).
 * Tabs: AI Providers, Shortcuts, Preferences, History.
 */
export default function Settings() {
  const { config, isLoading, saveSettings, updateProvider, updateShortcut, reload } =
    useSettings();
  const [activeTab, setActiveTab] = useState<TabId>('providers');
  const [shortcutInput, setShortcutInput] = useState(DEFAULT_SHORTCUT);
  const [excludedApps, setExcludedApps] = useState<string[]>([]);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    if (config) {
      setShortcutInput(config.shortcut ?? DEFAULT_SHORTCUT);
      setExcludedApps(config.excludedApps ?? []);
    }
  }, [config]);

  useEffect(() => {
    const loadExcluded = async () => {
      const apps = await window.electronAPI.getExcludedApps();
      setExcludedApps(apps);
    };
    loadExcluded();
  }, [activeTab]);

  const handleAddExcluded = async (app: string) => {
    const ok = await window.electronAPI.addExcludedApp(app);
    if (ok) {
      setExcludedApps((prev) => [...prev, app]);
      reload();
    }
  };

  const handleRemoveExcluded = async (app: string) => {
    const ok = await window.electronAPI.removeExcludedApp(app);
    if (ok) {
      setExcludedApps((prev) => prev.filter((a) => a !== app));
      reload();
    }
  };

  if (isLoading || !config) {
    return (
      <div className="settings-panel">
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <div className="settings-header-content">
          {!logoError ? (
            <img 
              src={LOGO_PATH} 
              alt="WriteUp Logo" 
              className="settings-logo"
              onError={() => {
                console.error(`[Settings] Failed to load logo from: ${LOGO_PATH}`);
                setLogoError(true);
              }}
              onLoad={() => {
                console.log(`[Settings] Logo loaded successfully from: ${LOGO_PATH}`);
              }}
            />
          ) : (
            <div className="settings-logo settings-logo-placeholder" title="Logo not found">
              WU
            </div>
          )}
          <h2>WriteUp – Settings</h2>
        </div>
      </div>
      <div className="settings-tabs">
        <button
          type="button"
          className={activeTab === 'providers' ? 'active' : ''}
          onClick={() => setActiveTab('providers')}
        >
          AI Providers
        </button>
        <button
          type="button"
          className={activeTab === 'shortcuts' ? 'active' : ''}
          onClick={() => setActiveTab('shortcuts')}
        >
          Shortcuts
        </button>
        <button
          type="button"
          className={activeTab === 'preferences' ? 'active' : ''}
          onClick={() => setActiveTab('preferences')}
        >
          Preferences
        </button>
        <button
          type="button"
          className={activeTab === 'history' ? 'active' : ''}
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
      </div>
      <div className="settings-content">
        {activeTab === 'providers' && (
          <ProvidersTab
            providers={config.providers}
            updateProvider={updateProvider}
            reload={reload}
          />
        )}
        {activeTab === 'shortcuts' && (
          <ShortcutsTab
            shortcut={shortcutInput || DEFAULT_SHORTCUT}
            onShortcutChange={setShortcutInput}
            onSave={async () => updateShortcut(shortcutInput || DEFAULT_SHORTCUT)}
          />
        )}
        {activeTab === 'preferences' && (
          <PreferencesTab
            config={config}
            onSave={saveSettings}
            excludedApps={excludedApps}
            onAddExcludedApp={handleAddExcluded}
            onRemoveExcludedApp={handleRemoveExcluded}
          />
        )}
        {activeTab === 'history' && (
          config.enableHistory ? (
            <HistoryList />
          ) : (
            <p className="history-disabled">Enable history in Preferences to see past enhancements.</p>
          )
        )}
      </div>
    </div>
  );
}
