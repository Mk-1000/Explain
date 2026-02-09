import { useState } from 'react';
import type { AppConfig } from '@shared/types';
import { ENHANCEMENT_TYPES } from '@shared/constants';
import './styles.css';

interface PreferencesTabProps {
  config: AppConfig | null;
  onSave: (config: AppConfig) => Promise<boolean>;
  excludedApps: string[];
  onAddExcludedApp: (app: string) => Promise<boolean>;
  onRemoveExcludedApp: (app: string) => Promise<boolean>;
}

export default function PreferencesTab({
  config,
  onSave,
  excludedApps,
  onAddExcludedApp,
  onRemoveExcludedApp,
}: PreferencesTabProps) {
  const [newExcludedApp, setNewExcludedApp] = useState('');

  if (!config) return null;

  const update = (patch: Partial<AppConfig>) => {
    onSave({ ...config, ...patch });
  };

  return (
    <div className="settings-section">
      <h3>Preferences</h3>
      <div className="preference-item">
        <label>Theme</label>
        <select
          value={config.theme}
          onChange={(e) =>
            update({ theme: e.target.value as 'light' | 'dark' | 'system' })
          }
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>
      <div className="preference-item">
        <label>Default enhancement type</label>
        <select
          value={config.defaultEnhancementType}
          onChange={(e) => update({ defaultEnhancementType: e.target.value })}
        >
          {ENHANCEMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="preference-item">
        <label>
          <input
            type="checkbox"
            checked={config.showMultipleSuggestions}
            onChange={(e) => update({ showMultipleSuggestions: e.target.checked })}
          />
          Show multiple suggestions
        </label>
      </div>
      <div className="preference-item">
        <label>
          <input
            type="checkbox"
            checked={config.enableHistory}
            onChange={(e) => update({ enableHistory: e.target.checked })}
          />
          Enable history
        </label>
      </div>
      <div className="preference-item">
        <label>
          <input
            type="checkbox"
            checked={config.startAtLogin}
            onChange={(e) => update({ startAtLogin: e.target.checked })}
          />
          Start at login
        </label>
      </div>
      <div className="preference-item">
        <label>Excluded apps (no enhancement when focused)</label>
        <div className="excluded-apps-list">
          {excludedApps.map((app) => (
            <div key={app} className="excluded-app-row">
              <span>{app}</span>
              <button
                type="button"
                className="btn-small"
                onClick={() => onRemoveExcludedApp(app)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <div className="add-excluded">
          <input
            type="text"
            value={newExcludedApp}
            onChange={(e) => setNewExcludedApp(e.target.value)}
            placeholder="App name"
          />
          <button
            type="button"
            className="btn-secondary"
            onClick={async () => {
              if (newExcludedApp.trim()) {
                await onAddExcludedApp(newExcludedApp.trim());
                setNewExcludedApp('');
              }
            }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
