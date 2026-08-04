import { useEffect, useRef } from 'react';
import type { ToastItem } from '../components/ToastRegion.js';

// Exported separately so the actual decision logic can be unit-tested
// without rendering a React component — the useEffect/ref wiring below
// is just plumbing, this is the only real logic.
export function shouldNotify(error: string | null, lastShown: string | null): boolean {
  return error !== null && error !== lastShown;
}

export function useErrorToast(
  error: string | null,
  retry: () => void,
  showToast: (message: string, tone: ToastItem['tone'], action?: ToastItem['action']) => void,
) {
  const lastShown = useRef<string | null>(null);
  useEffect(() => {
    if (shouldNotify(error, lastShown.current)) {
      showToast(error as string, 'error', { label: 'Retry', onClick: retry });
      lastShown.current = error;
    }
    if (!error) lastShown.current = null;
  }, [error, retry, showToast]);
}