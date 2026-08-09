import { useEffect, useRef } from 'react';
import type { ToastItem } from '../components/ToastRegion.js';

export function shouldNotify(error: string | null, errorSeq: number, lastShownSeq: number | null): boolean {
  return error !== null && errorSeq !== lastShownSeq;
}

export function useErrorToast(
  error: string | null,
  errorSeq: number,
  retry: (() => void) | null,
  showToast: (message: string, tone: ToastItem['tone'], action?: ToastItem['action']) => number,
  dismissToast?: (id: number) => void,
) {
  const lastShownSeq = useRef<number | null>(null);
  const lastShownId = useRef<number | null>(null);

  useEffect(() => {
    if (shouldNotify(error, errorSeq, lastShownSeq.current)) {
      lastShownId.current = showToast(error as string, 'error', retry ? { label: 'Retry', onClick: retry } : undefined);
      lastShownSeq.current = errorSeq;
    }
    if (!error) {
      lastShownSeq.current = null;
      if (lastShownId.current !== null) {
        dismissToast?.(lastShownId.current);
        lastShownId.current = null;
      }
    }
  }, [error, errorSeq, retry, showToast, dismissToast]);
}