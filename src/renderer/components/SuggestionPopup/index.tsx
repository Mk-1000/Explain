import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Suggestion } from '@shared/types';
import { getWordDiff, getDiffStats, type DiffPart } from '../../utils/text-diff';
import './styles.css';

interface SuggestionPopupProps {
  originalText: string;
  suggestions: Suggestion[];
  onAccept: (suggestion: Suggestion) => void;
  onDismiss: () => void;
  onCopy: (text: string) => void;
  isLoading: boolean;
  error: string | null;
  emptyStateMessage?: string | null;
  hasText?: boolean;
  shortcut?: string;
}

export default function SuggestionPopup({
  originalText,
  suggestions,
  onAccept,
  onDismiss,
  onCopy,
  isLoading,
  error,
  emptyStateMessage,
  hasText = true,
  shortcut = 'Ctrl+Alt+E',
}: SuggestionPopupProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showDiff, setShowDiff] = useState(false);

  useEffect(() => {
    setSelectedIndex(0);
  }, [suggestions]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isLoading) return;
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (suggestions[selectedIndex]) onAccept(suggestions[selectedIndex]);
          break;
        case 'Escape':
          e.preventDefault();
          onDismiss();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoading, selectedIndex, suggestions, onAccept, onDismiss]);

  const handleSettingsClick = () => {
    if (typeof window.electronAPI?.showSettings === 'function') {
      window.electronAPI.showSettings();
    }
  };

  return (
    <div className="suggestion-popup">
      <div className="popup-header">
        <h3>AI Suggestions</h3>
        <div className="popup-header-actions">
          <button
            type="button"
            className="settings-btn"
            onClick={handleSettingsClick}
            aria-label="Open Settings"
            title="Open Settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 15a3 3 0 100-6 3 3 0 000 6z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button type="button" className="close-btn" onClick={onDismiss} aria-label="Close">
            ×
          </button>
        </div>
      </div>

      {emptyStateMessage || !hasText ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M9 12h6m-3-3v6m-9 1V8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          {emptyStateMessage ? (
            <>
              <h2 className="empty-state-title">
                {emptyStateMessage.split('\n\n')[0]}
              </h2>
              <p className="empty-state-message">
                {emptyStateMessage.split('\n\n').slice(1).join('\n\n')}
              </p>
            </>
          ) : (
            <>
              <h2 className="empty-state-title">No Text Selected</h2>
              <p className="empty-state-message">
                Please select some text first, then press the shortcut again.
              </p>
              <div className="instructions">
                <ol>
                  <li>Select text in any application</li>
                  <li>Press <kbd>{shortcut}</kbd> (or your configured shortcut)</li>
                  <li>Choose an enhancement option</li>
                </ol>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="original-text">
          <label>Original:</label>
          <p>{originalText}</p>
        </div>
      )}

      {error && (
        <div className="error-state">
          <p>{error}</p>
        </div>
      )}

      {isLoading && !error && (
        <div className="loading-state">
          <div className="spinner" />
          <p>Generating suggestions...</p>
        </div>
      )}

      {!isLoading && !error && suggestions.length > 0 && (
        <div className="suggestions-list">
          <AnimatePresence>
            {suggestions.map((suggestion, index) => (
              <motion.div
                key={`${suggestion.type}-${index}`}
                className={`suggestion-item ${index === selectedIndex ? 'selected' : ''}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setSelectedIndex(index)}
              >
                <div className="suggestion-header">
                  <span className="suggestion-type">{suggestion.type}</span>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {originalText && (
                      <button
                        type="button"
                        className="btn-diff-toggle"
                        onClick={() => setShowDiff(!showDiff)}
                        title="Toggle diff view"
                      >
                        {showDiff ? '📊' : '🔍'} Diff
                      </button>
                    )}
                    <span className="confidence">
                      {Math.round((suggestion.confidence ?? 1) * 100)}%
                    </span>
                  </div>
                </div>
                {showDiff && originalText ? (
                  <DiffView original={originalText} enhanced={suggestion.text} />
                ) : (
                  <p className="suggestion-text">{suggestion.text}</p>
                )}
                {originalText && showDiff && (
                  <div className="diff-stats">
                    <DiffStatsDisplay original={originalText} enhanced={suggestion.text} />
                  </div>
                )}
                <div className="suggestion-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => onAccept(suggestion)}
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => onCopy(suggestion.text)}
                  >
                    Copy
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {!isLoading && !error && suggestions.length > 0 && (
        <div className="popup-footer">
          <div className="keyboard-hints">
            <span>↑↓ Navigate</span>
            <span>Enter Accept</span>
            <span>Esc Dismiss</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Diff view component showing word-level changes.
 */
function DiffView({ original, enhanced }: { original: string; enhanced: string }) {
  const diffParts = getWordDiff(original, enhanced);

  return (
    <div className="diff-view">
      {diffParts.map((part, index) => {
        if (part.added) {
          return (
            <span key={index} className="diff-added">
              {part.value}
            </span>
          );
        }
        if (part.removed) {
          return (
            <span key={index} className="diff-removed">
              {part.value}
            </span>
          );
        }
        return <span key={index}>{part.value}</span>;
      })}
    </div>
  );
}

/**
 * Display diff statistics (additions, deletions, word count).
 */
function DiffStatsDisplay({ original, enhanced }: { original: string; enhanced: string }) {
  const stats = getDiffStats(original, enhanced);

  return (
    <div className="diff-stats-container">
      <span className="diff-stat">
        <strong>+{stats.additions}</strong> added
      </span>
      <span className="diff-stat">
        <strong>-{stats.deletions}</strong> removed
      </span>
      <span className="diff-stat">
        <strong>{stats.wordCount}</strong> words
      </span>
    </div>
  );
}
