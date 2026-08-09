import { useEffect, useRef } from 'react';
import type { ToastItem } from '../components/ToastRegion.js';

// errorSeq (not the message string) drives re-notification: React skips a
// useEffect([error]) re-run when the new value equals the old one, so a
// retry that fails with the identical message would otherwise show no
// toast at all — see useAsyncError.
export function shouldNotify(error: string | null, errorSeq: number, lastShownSeq: number | null): boolean {
  return error !== null && errorSeq !== lastShownSeq;
}

export function useErrorToast(
  error: string | null,
  errorSeq: number,
  retry: (() => void) | null,
  showToast: (message: string, tone: ToastItem['tone'], action?: ToastItem['action']) => void,
) {
  const lastShownSeq = useRef<number | null>(null);

  useEffect(() => {
    if (shouldNotify(error, errorSeq, lastShownSeq.current)) {
      showToast(error as string, 'error', retry ? { label: 'Retry', onClick: retry } : undefined);
      lastShownSeq.current = errorSeq;
    }
    if (!error) lastShownSeq.current = null;
  }, [error, errorSeq, retry, showToast]);
}