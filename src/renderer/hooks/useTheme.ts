import { useEffect, useState } from 'react';
import type { AppConfig } from '@shared/types';

/**
 * Hook to manage theme application to HTML elements.
 * Reads theme from config and applies data-theme attribute.
 */
export function useTheme(config: AppConfig | null): void {
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );

  useEffect(() => {
    // Listen to system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    // Check initial value
    handleChange(mediaQuery);

    // Listen for changes
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  useEffect(() => {
    if (!config) return;

    const htmlElement = document.documentElement;
    let effectiveTheme: 'light' | 'dark';

    if (config.theme === 'system') {
      effectiveTheme = systemTheme;
    } else {
      effectiveTheme = config.theme;
    }

    // Apply data-theme attribute
    htmlElement.setAttribute('data-theme', effectiveTheme);
  }, [config, systemTheme]);
}
