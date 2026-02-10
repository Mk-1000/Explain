import { useState, useEffect } from 'react';
import SuggestionPopup from './components/SuggestionPopup';
import { writeClipboard, writeAndPaste } from './utils/clipboard';
import type { Suggestion, EnhancementResult } from '@shared/types';

function isEnhancementError(
  result: EnhancementResult | { error: string; code: string }
): result is { error: string; code: string } {
  return result != null && 'error' in result && 'code' in result;
}

const NO_PROVIDERS_HINT = 'Add and enable at least one AI provider in Settings → AI Providers (API key + checkbox).';

interface CaptureMetadata {
  capturedFrom: 'selection' | 'clipboard' | 'fallback' | 'none';
  copySimulated: boolean;
  captureMethod?: 'robotjs' | 'native-clipboard' | 'system-command' | 'xdotool' | 'wtype' | 'osascript' | 'powershell';
  attemptCount?: number;
  totalDuration?: number;
  platformToolAvailable: boolean;
  installInstructions?: string | null;
}

/**
 * Generates context-aware empty state message based on capture metadata.
 */
function getEmptyStateMessage(metadata?: CaptureMetadata): {
  title: string;
  message: string;
  hint?: string;
  installInstructions?: string | null;
} {
  if (!metadata) {
    return {
      title: 'No Text Found',
      message: 'Select some text and press the shortcut to enhance it.',
      hint: 'You can also copy text to clipboard first.',
    };
  }

  const { capturedFrom, copySimulated, platformToolAvailable, installInstructions } = metadata;

  // Case 1: Platform tools not available
  if (!platformToolAvailable) {
    return {
      title: 'Setup Required',
      message: 'Text selection automation is not available on your system.',
      hint: installInstructions || 'Please copy text manually (Ctrl+C) before using the shortcut.',
      installInstructions: installInstructions || null,
    };
  }

  // Case 2: Copy was simulated but no text captured (nothing selected)
  if (copySimulated && capturedFrom === 'none') {
    return {
      title: 'No Text Selected',
      message: 'Please select some text first, then press the shortcut.',
      hint: 'Tip: Highlight text with your mouse or keyboard before activating.',
    };
  }

  // Case 3: Copy failed to simulate
  if (!copySimulated && capturedFrom === 'none') {
    return {
      title: 'Could Not Capture Text',
      message: 'The text capture mechanism failed.',
      hint: 'Try copying text manually (Ctrl+C or Cmd+C) first, then use the shortcut.',
    };
  }

  // Case 4: Fallback to clipboard (copy didn't capture new text)
  if (copySimulated && capturedFrom === 'fallback') {
    return {
      title: 'Using Clipboard Text',
      message: 'No new text was selected, using clipboard content instead.',
      hint: 'Select text before using the shortcut for better results.',
    };
  }

  // Case 5: Clipboard empty
  if (capturedFrom === 'clipboard') {
    return {
      title: 'Clipboard Empty',
      message: 'No text found in clipboard.',
      hint: 'Copy some text (Ctrl+C / Cmd+C) first, then use the shortcut.',
    };
  }

  // Default case
  return {
    title: 'No Text Available',
    message: 'Select or copy some text, then press the shortcut.',
  };
}

export default function PopupApp() {
  const [originalText, setOriginalText] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emptyStateMessage, setEmptyStateMessage] = useState<string | null>(null);
  const [lastProvider, setLastProvider] = useState<string>('AI');
  const [shortcut, setShortcut] = useState<string>('Ctrl+Alt+E');
  const [hasText, setHasText] = useState<boolean>(false);

  useEffect(() => {
    // Fetch shortcut on mount
    window.electronAPI.getShortcut().then((shortcutValue) => {
      // Convert Electron accelerator format to user-friendly format
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const friendlyShortcut = shortcutValue
        .replace(/CommandOrControl/gi, isMac ? 'Cmd' : 'Ctrl')
        .replace(/Command/gi, 'Cmd')
        .replace(/Control/gi, 'Ctrl')
        .replace(/Option/gi, 'Alt');
      setShortcut(friendlyShortcut);
    });
  }, []);

  useEffect(() => {
    const api = window.electronAPI;
    api.onTextSelected(async (data: { 
      text: string; 
      hasText: boolean;
      timestamp: number; 
      captureMetadata?: CaptureMetadata;
    }) => {
      const text = data.text?.trim() ?? '';
      const hasTextValue = data.hasText ?? (text.length > 0);
      setHasText(hasTextValue);
      setError(null);
      setSuggestions([]);
      if (!text || !hasTextValue) {
        setOriginalText('');
        const emptyState = getEmptyStateMessage(data.captureMetadata);
        // Combine title, message, and hint into a single message for now
        let message = emptyState.title;
        if (emptyState.message) {
          message += `\n\n${emptyState.message}`;
        }
        if (emptyState.hint) {
          message += `\n\n💡 ${emptyState.hint}`;
        }
        if (emptyState.installInstructions) {
          message += `\n\n📦 Installation:\n${emptyState.installInstructions}`;
        }
        setEmptyStateMessage(message);
        setLoading(false);
        return;
      }
      setEmptyStateMessage(null);
      setOriginalText(text);
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
        const message = err instanceof Error ? err.message : 'Enhancement failed';
        setError(
          message.includes('No configured providers')
            ? `${message} ${NO_PROVIDERS_HINT}`
            : message
        );
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
        emptyStateMessage={emptyStateMessage}
        hasText={hasText}
        shortcut={shortcut}
      />
    </div>
  );
}
