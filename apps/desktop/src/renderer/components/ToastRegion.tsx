import React, { useCallback, useState } from 'react';

export interface ToastItem {
  id: number;
  message: string;
  tone: 'error' | 'success' | 'info';
}

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((message: string, tone: ToastItem['tone'] = 'info') => {
    const id = Date.now() + Math.floor(Math.random() * 1_000);
    setToasts((current) => [...current, { id, message, tone }].slice(-3));
    window.setTimeout(() => dismiss(id), 5_000);
  }, [dismiss]);

  return { toasts, show, dismiss };
}

export function ToastRegion({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div aria-atomic="true" aria-live="polite" className="aur-toast-region">
      {toasts.map((toast) => (
        <div className={`aur-toast aur-toast-${toast.tone}`} key={toast.id} role={toast.tone === 'error' ? 'alert' : 'status'}>
          <span>{toast.message}</span>
          <button aria-label="Dismiss notification" onClick={() => onDismiss(toast.id)} type="button">×</button>
        </div>
      ))}
    </div>
  );
}
