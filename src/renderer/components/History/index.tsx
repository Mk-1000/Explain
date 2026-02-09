import { useState, useEffect } from 'react';
import type { HistoryItem } from '@shared/types';
import './styles.css';

export default function HistoryList() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const list = await window.electronAPI.getHistory();
      setItems(list ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleClear = async () => {
    if (!confirm('Clear all history?')) return;
    await window.electronAPI.clearHistory();
    setItems([]);
  };

  if (loading) return <div className="history-loading">Loading history...</div>;

  return (
    <div className="history-section">
      <div className="history-header">
        <h3>History</h3>
        <button type="button" className="btn-secondary" onClick={handleClear}>
          Clear history
        </button>
      </div>
      {items.length === 0 ? (
        <p className="history-empty">No history yet.</p>
      ) : (
        <ul className="history-list">
          {items.map((item) => (
            <li key={item.id} className="history-item">
              <div className="history-meta">
                <span className="history-type">{item.type}</span>
                <span className="history-time">
                  {new Date(item.timestamp).toLocaleString()}
                </span>
              </div>
              <div className="history-original">
                <strong>Original:</strong> {item.original}
              </div>
              <div className="history-enhanced">
                <strong>Enhanced:</strong> {item.enhanced}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
