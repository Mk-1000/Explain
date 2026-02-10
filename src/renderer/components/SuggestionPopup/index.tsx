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

  return (
    <div className="suggestion-popup">
      <div className="popup-header">
        <h3>AI Suggestions</h3>
        <button type="button" className="close-btn" onClick={onDismiss} aria-label="Close">
          ×
        </button>
      </div>

      {emptyStateMessage ? (
        <div className="empty-state">
          <p>{emptyStateMessage}</p>
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
