import { useState } from 'react';
import type { ProviderConfig } from '@shared/types';
import { PROVIDER_NAMES } from '@shared/constants';
import './styles.css';

interface ProvidersTabProps {
  providers: ProviderConfig[];
  updateProvider: (name: string, config: Partial<ProviderConfig>) => Promise<boolean>;
}

export default function ProvidersTab({ providers, updateProvider }: ProvidersTabProps) {
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, boolean | null>>({});

  const handleTest = async (name: string) => {
    setTesting(name);
    setTestResult((r) => ({ ...r, [name]: null }));
    try {
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
        model: name === 'OpenAI' ? 'gpt-4-turbo-preview' : name === 'Ollama (Local)' ? 'llama2' : name === 'Anthropic' ? 'claude-3-sonnet-20240229' : 'anthropic/claude-3-sonnet',
        enabled: false,
        priority: PROVIDER_NAMES.indexOf(name) + 1,
      }));

  return (
    <div className="settings-section">
      <h3>Configure AI Providers</h3>
      <p className="section-description">
        Add your API keys and enable providers. Lower priority number is tried first.
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
          </div>
          {provider.name !== 'Ollama (Local)' && (
            <div className="provider-fields">
              <div className="field">
                <label>API Key</label>
                <input
                  type="password"
                  value={provider.apiKey}
                  onChange={(e) =>
                    updateProvider(provider.name, { apiKey: e.target.value })
                  }
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
                value={provider.model}
                onChange={(e) =>
                  updateProvider(provider.name, { model: e.target.value })
                }
                placeholder="Model name"
              />
            </div>
            <div className="field">
              <label>Priority (1 = first)</label>
              <input
                type="number"
                min={1}
                max={10}
                value={provider.priority}
                onChange={(e) =>
                  updateProvider(provider.name, {
                    priority: parseInt(e.target.value, 10) || 1,
                  })
                }
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
