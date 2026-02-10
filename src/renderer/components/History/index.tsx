import { useState, useEffect, useMemo } from 'react';
import type { HistoryItem, HistoryStats } from '@shared/types';
import './styles.css';

type ViewMode = 'list' | 'grid' | 'stats';
type SortBy = 'timestamp' | 'length' | 'type';
type SortOrder = 'asc' | 'desc';

export default function HistoryList() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    type: null as string | null,
    provider: null as string | null,
    favorite: null as boolean | null,
  });
  const [view, setView] = useState<ViewMode>('list');
  const [sortBy, setSortBy] = useState<SortBy>('timestamp');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const load = async () => {
    setLoading(true);
    try {
      const list = await window.electronAPI.getHistory();
      setItems(list ?? []);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await window.electronAPI.getHistoryStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  useEffect(() => {
    load();
    loadStats();
  }, []);

  const filteredHistory = useMemo(() => {
    let filtered = items;

    // Apply search
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.original.toLowerCase().includes(lowerQuery) ||
          item.enhanced.toLowerCase().includes(lowerQuery) ||
          item.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery))
      );
    }

    // Apply filters
    if (filters.type) {
      filtered = filtered.filter((item) => item.type === filters.type);
    }
    if (filters.provider) {
      filtered = filtered.filter((item) => item.provider === filters.provider);
    }
    if (filters.favorite !== null) {
      filtered = filtered.filter((item) => item.favorite === filters.favorite);
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortBy) {
        case 'timestamp':
          aVal = a.timestamp;
          bVal = b.timestamp;
          break;
        case 'length':
          aVal = a.originalLength;
          bVal = b.originalLength;
          break;
        case 'type':
          aVal = a.type;
          bVal = b.type;
          break;
        default:
          return 0;
      }

      const comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [items, searchQuery, filters, sortBy, sortOrder]);

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const result = await window.electronAPI.exportHistory(format);
      if (result.success) {
        alert(`History exported to ${result.path}`);
      }
    } catch (error) {
      alert(`Failed to export: ${error}`);
    }
  };

  const handleToggleFavorite = async (id: string) => {
    await window.electronAPI.toggleFavorite(id);
    await load();
    await loadStats();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      await window.electronAPI.deleteHistory(id);
      await load();
      await loadStats();
    }
  };

  const handleCopyToClipboard = async (text: string, type: string) => {
    await window.electronAPI.writeClipboard(text);
    // Simple notification - could be enhanced with a toast library
    const notification = document.createElement('div');
    notification.textContent = `${type} copied to clipboard`;
    notification.style.cssText =
      'position: fixed; top: 20px; right: 20px; background: #007aff; color: white; padding: 12px 20px; border-radius: 6px; z-index: 10000;';
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
  };

  const handleClear = async () => {
    if (!confirm('Clear all history?')) return;
    await window.electronAPI.clearHistory();
    setItems([]);
    setStats(null);
    await loadStats();
  };

  // Get unique types and providers for filter dropdowns
  const uniqueTypes = useMemo(() => {
    const types = new Set(items.map((item) => item.type));
    return Array.from(types).sort();
  }, [items]);

  const uniqueProviders = useMemo(() => {
    const providers = new Set(items.map((item) => item.provider));
    return Array.from(providers).sort();
  }, [items]);

  if (loading) return <div className="history-loading">Loading history...</div>;

  return (
    <div className="history-panel">
      {/* Header with view toggles and actions */}
      <div className="history-header">
        <div className="view-controls">
          <button
            className={view === 'list' ? 'active' : ''}
            onClick={() => setView('list')}
          >
            List View
          </button>
          <button
            className={view === 'grid' ? 'active' : ''}
            onClick={() => setView('grid')}
          >
            Grid View
          </button>
          <button
            className={view === 'stats' ? 'active' : ''}
            onClick={() => setView('stats')}
          >
            Statistics
          </button>
        </div>

        <div className="history-actions">
          <button type="button" className="btn-secondary" onClick={() => handleExport('json')}>
            Export JSON
          </button>
          <button type="button" className="btn-secondary" onClick={() => handleExport('csv')}>
            Export CSV
          </button>
          <button type="button" className="btn-secondary danger" onClick={handleClear}>
            Clear All
          </button>
        </div>
      </div>

      {/* Search and filters */}
      <div className="history-filters">
        <input
          type="text"
          placeholder="Search history..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />

        <select
          value={filters.type || ''}
          onChange={(e) => setFilters({ ...filters, type: e.target.value || null })}
        >
          <option value="">All Types</option>
          {uniqueTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <select
          value={filters.provider || ''}
          onChange={(e) => setFilters({ ...filters, provider: e.target.value || null })}
        >
          <option value="">All Providers</option>
          {uniqueProviders.map((provider) => (
            <option key={provider} value={provider}>
              {provider}
            </option>
          ))}
        </select>

        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
          <option value="timestamp">Date</option>
          <option value="length">Length</option>
          <option value="type">Type</option>
        </select>

        <button
          type="button"
          className="btn-secondary"
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
        >
          {sortOrder === 'asc' ? '↑' : '↓'}
        </button>

        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            setFilters({
              type: filters.favorite === true ? null : null,
              provider: null,
              favorite: filters.favorite === true ? null : true,
            })
          }
        >
          {filters.favorite === true ? 'Show All' : 'Favorites Only'}
        </button>
      </div>

      {/* Stats view */}
      {view === 'stats' && stats && (
        <div className="history-stats">
          <div className="stat-card">
            <h3>Total Enhancements</h3>
            <div className="stat-value">{stats.totalEnhancements}</div>
          </div>

          <div className="stat-card">
            <h3>Characters Processed</h3>
            <div className="stat-value">
              {stats.totalCharactersProcessed.toLocaleString()}
            </div>
          </div>

          <div className="stat-card">
            <h3>Avg Processing Time</h3>
            <div className="stat-value">
              {stats.averageProcessingTime.toFixed(0)}ms
            </div>
          </div>

          <div className="stat-card">
            <h3>Most Used Type</h3>
            <div className="stat-value">{stats.mostUsedType}</div>
          </div>

          <div className="stat-card">
            <h3>Favorite Provider</h3>
            <div className="stat-value">{stats.mostUsedProvider}</div>
          </div>
        </div>
      )}

      {/* List/Grid view */}
      {view !== 'stats' && (
        <div className={`history-items ${view}`}>
          {filteredHistory.length === 0 ? (
            <div className="empty-state">
              <p>No history items found</p>
              {searchQuery && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setSearchQuery('')}
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            filteredHistory.map((item) => (
              <HistoryItem
                key={item.id}
                item={item}
                view={view}
                onToggleFavorite={handleToggleFavorite}
                onDelete={handleDelete}
                onCopy={handleCopyToClipboard}
              />
            ))
          )}
        </div>
      )}

      {/* Summary footer */}
      <div className="history-footer">
        Showing {filteredHistory.length} of {items.length} items
      </div>
    </div>
  );
}

interface HistoryItemProps {
  item: HistoryItem;
  view: ViewMode;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onCopy: (text: string, type: string) => void;
}

function HistoryItem({
  item,
  view,
  onToggleFavorite,
  onDelete,
  onCopy,
}: HistoryItemProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`history-item ${view} ${expanded ? 'expanded' : ''}`}>
      <div className="item-header">
        <div className="item-meta">
          <span className="item-date">
            {new Date(item.timestamp).toLocaleString()}
          </span>
          <span className={`item-type badge ${item.type}`}>{item.type}</span>
          <span className="item-provider badge">{item.provider}</span>
          {item.tags &&
            item.tags.map((tag) => (
              <span key={tag} className="item-tag badge">
                {tag}
              </span>
            ))}
        </div>

        <div className="item-actions">
          <button
            type="button"
            onClick={() => onToggleFavorite(item.id)}
            className={item.favorite ? 'favorited' : ''}
            title={item.favorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            {item.favorite ? '★' : '☆'}
          </button>

          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            title="Toggle details"
          >
            {expanded ? '▼' : '▶'}
          </button>

          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="danger"
            title="Delete"
          >
            🗑
          </button>
        </div>
      </div>

      <div className="item-content">
        <div className="item-section">
          <div className="section-header">
            <strong>Original</strong>
            <span className="char-count">{item.originalLength} chars</span>
            <button
              type="button"
              className="btn-small"
              onClick={() => onCopy(item.original, 'Original')}
            >
              Copy
            </button>
          </div>
          <div className="text-preview">
            {expanded
              ? item.original
              : `${item.original.substring(0, 100)}${
                  item.original.length > 100 ? '...' : ''
                }`}
          </div>
        </div>

        <div className="item-section">
          <div className="section-header">
            <strong>Enhanced</strong>
            <span className="char-count">{item.enhancedLength} chars</span>
            <button
              type="button"
              className="btn-small"
              onClick={() => onCopy(item.enhanced, 'Enhanced')}
            >
              Copy
            </button>
          </div>
          <div className="text-preview">
            {expanded
              ? item.enhanced
              : `${item.enhanced.substring(0, 100)}${
                  item.enhanced.length > 100 ? '...' : ''
                }`}
          </div>
        </div>

        {expanded && (
          <div className="item-details">
            {item.processingTime && (
              <div>Processing time: {item.processingTime}ms</div>
            )}
            {item.tokensUsed && <div>Tokens used: {item.tokensUsed}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
