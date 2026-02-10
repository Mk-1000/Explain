import { useState } from 'react';
import type { ProviderConfig } from '@shared/types';
import { PROVIDER_NAMES } from '@shared/constants';
import './styles.css';

interface ProvidersTabProps {
  providers: ProviderConfig[];
  updateProvider: (name: string, config: Partial<ProviderConfig>) => Promise<boolean>;
  reload: () => Promise<void>;
}

export default function ProvidersTab({ providers, updateProvider, reload }: ProvidersTabProps) {
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, boolean | null>>({});
  /** Local API key drafts; save to backend on blur so paste doesn't get cleared by refetch. */
  const [apiKeyDraft, setApiKeyDraft] = useState<Record<string, string>>({});
  const [modelDraft, setModelDraft] = useState<Record<string, string>>({});
  const [priorityDraft, setPriorityDraft] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, 'saving' | 'saved' | 'failed'>>({});
  const defaultModelForProvider = (name: string): string =>
    name === 'OpenAI'
      ? 'gpt-4o-mini'
      : name === 'OpenRouter'
        ? 'openai/gpt-4o-mini'
        : name === 'Anthropic'
          ? 'claude-3-sonnet-20240229'
          : 'llama2';

  const persistApiKeyDraft = async (name: string): Promise<boolean> => {
    const draftValue = apiKeyDraft[name];
    if (draftValue === undefined) {
      return true;
    }
    setSaveStatus((prev) => ({ ...prev, [name]: 'saving' }));
    const ok = await updateProvider(name, {
      apiKey: draftValue,
      ...(draftValue.trim() ? { enabled: true } : {}),
    });
    if (ok) {
      setSaveStatus((prev) => ({ ...prev, [name]: 'saved' }));
      setApiKeyDraft((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
      return true;
    }
    setSaveStatus((prev) => ({ ...prev, [name]: 'failed' }));
    return false;
  };

  const persistModelDraft = async (name: string): Promise<boolean> => {
    const draftValue = modelDraft[name];
    if (draftValue === undefined) return true;
    setSaveStatus((prev) => ({ ...prev, [name]: 'saving' }));
    const ok = await updateProvider(name, { model: draftValue.trim() || defaultModelForProvider(name) });
    if (ok) {
      setSaveStatus((prev) => ({ ...prev, [name]: 'saved' }));
      setModelDraft((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
      return true;
    }
    setSaveStatus((prev) => ({ ...prev, [name]: 'failed' }));
    return false;
  };

  const persistPriorityDraft = async (name: string, currentPriority: number): Promise<boolean> => {
    const draftValue = priorityDraft[name];
    if (draftValue === undefined) return true;
    const parsed = Number.parseInt(draftValue, 10);
    const priority = Number.isFinite(parsed) ? Math.max(1, Math.min(10, parsed)) : currentPriority;
    setSaveStatus((prev) => ({ ...prev, [name]: 'saving' }));
    const ok = await updateProvider(name, { priority });
    if (ok) {
      setSaveStatus((prev) => ({ ...prev, [name]: 'saved' }));
      setPriorityDraft((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
      // Reload settings to reflect reordered priorities
      if (priority === 1 && currentPriority !== 1) {
        await reload();
      }
      return true;
    }
    setSaveStatus((prev) => ({ ...prev, [name]: 'failed' }));
    return false;
  };

  const handleTest = async (name: string) => {
    setTesting(name);
    setTestResult((r) => ({ ...r, [name]: null }));
    try {
      const persisted = await persistApiKeyDraft(name);
      if (!persisted) {
        setTestResult((r) => ({ ...r, [name]: false }));
        return;
      }
      const res = await window.electronAPI.testProvider(name);
      setTestResult((r) => ({ ...r, [name]: res.success }));
    } finally {
      setTesting(null);
    }
  };

  const list = providers.length
    ? providers
    : PROVIDER_NAMES.map((name) => ({
        name,
        apiKey: '',
        model: defaultModelForProvider(name),
        enabled: false,
        priority: PROVIDER_NAMES.indexOf(name) + 1,
      }));

  return (
    <div className="settings-section">
      <h3>Configure AI Providers</h3>
      <p className="section-description">
        Add your API keys and enable providers. Lower priority number is tried first. Enter an API key and check the box to enable; at least one provider must be enabled.
      </p>
      {list.map((provider) => (
        <div key={provider.name} className="provider-card">
          <div className="provider-header">
            <div className="provider-title">
              <input
                type="checkbox"
                checked={provider.enabled}
                onChange={(e) =>
                  updateProvider(provider.name, { enabled: e.target.checked })
                }
              />
              <h4>{provider.name}</h4>
            </div>
            <button
              type="button"
              className="test-btn"
              disabled={testing !== null}
              onClick={() => handleTest(provider.name)}
            >
              {testing === provider.name ? 'Testing...' : 'Test'}
            </button>
            {testResult[provider.name] === true && <span className="test-ok">OK</span>}
            {testResult[provider.name] === false && <span className="test-fail">Failed</span>}
            {saveStatus[provider.name] === 'saving' && <span className="test-ok">Saving...</span>}
            {saveStatus[provider.name] === 'saved' && <span className="test-ok">Saved</span>}
            {saveStatus[provider.name] === 'failed' && (
              <span className="test-fail">Save failed</span>
            )}
          </div>
          {provider.name !== 'Ollama (Local)' && (
            <div className="provider-fields">
              <div className="field">
                <label>API Key</label>
                <input
                  type="password"
                  value={apiKeyDraft[provider.name] ?? provider.apiKey ?? ''}
                  onChange={(e) =>
                    setApiKeyDraft((prev) => ({ ...prev, [provider.name]: e.target.value }))
                  }
                  onBlur={async () => {
                    await persistApiKeyDraft(provider.name);
                  }}
                  placeholder="Enter API key"
                />
              </div>
            </div>
          )}
          <div className="provider-fields">
            <div className="field">
              <label>Model</label>
              <input
                type="text"
                value={modelDraft[provider.name] ?? provider.model}
                onChange={(e) =>
                  setModelDraft((prev) => ({ ...prev, [provider.name]: e.target.value }))
                }
                onBlur={async () => {
                  await persistModelDraft(provider.name);
                }}
                placeholder="Model name"
              />
            </div>
            <div className="field">
              <label>Priority (1 = first)</label>
              <input
                type="number"
                min={1}
                max={10}
                value={priorityDraft[provider.name] ?? String(provider.priority)}
                onChange={(e) =>
                  setPriorityDraft((prev) => ({ ...prev, [provider.name]: e.target.value }))
                }
                onBlur={async () => {
                  await persistPriorityDraft(provider.name, provider.priority);
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
