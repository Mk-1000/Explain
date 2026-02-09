import { useState, useEffect } from 'react';
import SuggestionPopup from './components/SuggestionPopup';
import { writeClipboard, writeAndPaste } from './utils/clipboard';
import type { Suggestion, EnhancementResult } from '@shared/types';

function isEnhancementError(
  result: EnhancementResult | { error: string; code: string }
): result is { error: string; code: string } {
  return result != null && 'error' in result && 'code' in result;
}

export default function PopupApp() {
  const [originalText, setOriginalText] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastProvider, setLastProvider] = useState<string>('AI');

  useEffect(() => {
    const api = window.electronAPI;
    api.onTextSelected(async (data: { text: string; timestamp: number }) => {
      const text = data.text?.trim() ?? '';
      if (!text) return;
      setOriginalText(text);
      setSuggestions([]);
      setError(null);
      setLoading(true);
      try {
        const config = await api.getConfig();
        const enhancementType = (config?.defaultEnhancementType as string) ?? 'rephrase';
        const result = await api.enhanceText(text, {
          type: enhancementType as 'grammar' | 'rephrase' | 'formal' | 'casual' | 'concise' | 'expand',
          maxVariants: config?.showMultipleSuggestions ? 3 : 1,
        });
        if (isEnhancementError(result)) {
          setError(result.error);
          setSuggestions([]);
        } else {
          setSuggestions(result.suggestions ?? []);
          setLastProvider(result.provider ?? 'AI');
          setError(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Enhancement failed');
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    });
    return () => {
      api.removeAllListeners('text-selected');
    };
  }, []);

  const handleAccept = (suggestion: Suggestion) => {
    writeAndPaste(suggestion.text);
    window.electronAPI.addHistory({
      original: originalText,
      enhanced: suggestion.text,
      type: suggestion.type,
      provider: lastProvider,
    });
  };

  const handleDismiss = () => {
    window.electronAPI.closePopup();
  };

  const handleCopy = (text: string) => {
    writeClipboard(text);
  };

  return (
    <div className="popup-root" style={{ background: 'transparent', padding: 0, margin: 0 }}>
      <SuggestionPopup
        originalText={originalText}
        suggestions={suggestions}
        onAccept={handleAccept}
        onDismiss={handleDismiss}
        onCopy={handleCopy}
        isLoading={loading}
        error={error}
      />
    </div>
  );
}
