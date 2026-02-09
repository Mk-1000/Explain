import { useState, useEffect } from 'react';
import { useSettings } from '../../hooks/useSettings';
import ProvidersTab from './ProvidersTab';
import ShortcutsTab from './ShortcutsTab';
import PreferencesTab from './PreferencesTab';
import HistoryList from '../History';
import './styles.css';

type TabId = 'providers' | 'shortcuts' | 'preferences' | 'history';

/**
 * Settings panel (quick-start-guide: components/Settings/index.tsx).
 * Tabs: AI Providers, Shortcuts, Preferences, History.
 */
export default function Settings() {
  const { config, isLoading, saveSettings, updateProvider, updateShortcut, reload } =
    useSettings();
  const [activeTab, setActiveTab] = useState<TabId>('providers');
  const [shortcutInput, setShortcutInput] = useState('');
  const [excludedApps, setExcludedApps] = useState<string[]>([]);

  useEffect(() => {
    if (config) {
      setShortcutInput(config.shortcut);
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
        <h2>AI Text Enhancer – Settings</h2>
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
          />
        )}
        {activeTab === 'shortcuts' && (
          <ShortcutsTab
            shortcut={shortcutInput}
            onShortcutChange={setShortcutInput}
            onSave={async () => updateShortcut(shortcutInput)}
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
