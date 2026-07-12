import React, { useEffect, useRef } from 'react';

interface DialogFrameProps {
  title: string;
  description: string;
  children: React.ReactNode;
  onDismiss: () => void;
  focusDismiss?: boolean;
}

function DialogFrame({ title, description, children, onDismiss, focusDismiss = true }: DialogFrameProps) {
  const dismissRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (focusDismiss) dismissRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusDismiss, onDismiss]);

  return (
    <div className="aur-dialog-backdrop" onMouseDown={onDismiss}>
      <section
        aria-describedby="aur-dialog-description"
        aria-labelledby="aur-dialog-title"
        aria-modal="true"
        className="aur-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="aur-dialog-heading">
          <div>
            <h2 id="aur-dialog-title">{title}</h2>
            <p id="aur-dialog-description">{description}</p>
          </div>
          <button ref={dismissRef} aria-label="Close dialog" className="aur-dialog-close" onClick={onDismiss} type="button">×</button>
        </div>
        {children}
      </section>
    </div>
  );
}

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({ title, description, confirmLabel, tone = 'primary', onCancel, onConfirm }: ConfirmDialogProps) {
  return (
    <DialogFrame title={title} description={description} onDismiss={onCancel} focusDismiss={false}>
      <div className="aur-dialog-actions">
        <button className="aur-button" onClick={onCancel} type="button">Cancel</button>
        <button className={tone === 'danger' ? 'aur-button aur-button-danger' : 'aur-button aur-button-primary'} onClick={onConfirm} type="button">{confirmLabel}</button>
      </div>
    </DialogFrame>
  );
}

interface PromptDialogProps {
  title: string;
  description: string;
  label: string;
  placeholder: string;
  confirmLabel: string;
  value: string;
  onCancel: () => void;
  onChange: (value: string) => void;
  onConfirm: () => void;
}

export function PromptDialog({ title, description, label, placeholder, confirmLabel, value, onCancel, onChange, onConfirm }: PromptDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <DialogFrame title={title} description={description} onDismiss={onCancel}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (value.trim()) onConfirm();
        }}
      >
        <label className="aur-dialog-field">
          <span>{label}</span>
          <input ref={inputRef} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} value={value} />
        </label>
        <div className="aur-dialog-actions">
          <button className="aur-button" onClick={onCancel} type="button">Cancel</button>
          <button className="aur-button aur-button-primary" disabled={!value.trim()} type="submit">{confirmLabel}</button>
        </div>
      </form>
    </DialogFrame>
  );
}
