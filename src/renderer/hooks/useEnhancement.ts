import { useState, useCallback } from 'react';
import type { EnhancementOptions, EnhancementResult } from '@shared/types';

function isEnhancementError(
  result: EnhancementResult | { error: string; code: string }
): result is { error: string; code: string } {
  return result != null && 'error' in result && 'code' in result;
}

export function useEnhancement() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EnhancementResult | null>(null);

  const enhance = useCallback(async (text: string, options: EnhancementOptions) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const enhancementResult = await window.electronAPI.enhanceText(text, options);
      if (isEnhancementError(enhancementResult)) {
        setError(enhancementResult.error);
        return null;
      }
      setResult(enhancementResult);
      return enhancementResult;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Enhancement failed';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setResult(null);
  }, []);

  return { enhance, reset, isLoading, error, result };
}
