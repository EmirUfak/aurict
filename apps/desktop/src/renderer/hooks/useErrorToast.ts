import { useCallback, useEffect, useRef } from 'react';
import type { ToastItem } from '../components/ToastRegion.js';

export function shouldNotify(error: string | null, lastShown: string | null): boolean {
  return error !== null && error !== lastShown;
}

export function useErrorToast(
  error: string | null,
  retry: (() => void) | null,
  showToast: (message: string, tone: ToastItem['tone'], action?: ToastItem['action']) => void,
) {
  const lastShown = useRef<string | null>(null);

  const handleRetry = useCallback(() => {
    lastShown.current = null;
    retry?.();
  }, [retry]);

  useEffect(() => {
    if (shouldNotify(error, lastShown.current)) {
      showToast(error as string, 'error', retry ? { label: 'Retry', onClick: handleRetry } : undefined);
      lastShown.current = error;
    }
    if (!error) lastShown.current = null;
  }, [error, handleRetry, showToast, retry]);
}