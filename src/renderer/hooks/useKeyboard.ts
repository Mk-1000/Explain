import { useEffect } from 'react';

interface UseKeyboardOptions {
  selectedIndex: number;
  length: number;
  onAccept: () => void;
  onDismiss: () => void;
  onCopy?: () => void;
  setSelectedIndex: (updater: (prev: number) => number) => void;
  enabled: boolean;
}

export function useKeyboard({
  selectedIndex,
  length,
  onAccept,
  onDismiss,
  onCopy,
  setSelectedIndex,
  enabled,
}: UseKeyboardOptions): void {
  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : length - 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev < length - 1 ? prev + 1 : 0));
          break;
        case 'Enter':
          e.preventDefault();
          onAccept();
          break;
        case 'Escape':
          e.preventDefault();
          onDismiss();
          break;
        case 'c':
          if ((e.ctrlKey || e.metaKey) && onCopy) {
            e.preventDefault();
            onCopy();
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    enabled,
    length,
    onAccept,
    onDismiss,
    onCopy,
    setSelectedIndex,
  ]);
}
