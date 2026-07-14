import React, { useEffect, useRef, useState } from 'react';
import type { PermissionRequestPayload, PermissionDecision } from '../../shared/ipc-types.js';

interface Props {
  request: PermissionRequestPayload;
  onRespond: (decision: PermissionDecision) => void;
  onEnableAutoApproveSafe: () => Promise<void>;
}

const LEVEL_META = {
  safe: { color: 'var(--safe)', label: 'safe' },
  warning: { color: 'var(--warning)', label: 'warning' },
  danger: { color: 'var(--danger)', label: 'danger' },
} as const;

export function ApprovalModal({ request, onRespond, onEnableAutoApproveSafe }: Props) {
  const stopProp = (e: React.MouseEvent) => e.stopPropagation();
  const meta = LEVEL_META[request.level ?? 'warning'];
  const denyRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [enablingAutoApprove, setEnablingAutoApprove] = useState(false);
  const [autoApproveError, setAutoApproveError] = useState<string | null>(null);
  const canAutoApprove = request.level === 'safe';

  const enableAutoApprove = async () => {
    if (!canAutoApprove || enablingAutoApprove) return;
    setEnablingAutoApprove(true);
    setAutoApproveError(null);
    try {
      await onEnableAutoApproveSafe();
      onRespond('allow_once');
    } catch (error) {
      console.error('Failed to enable safe auto-approval', error);
      setAutoApproveError(error instanceof Error ? error.message : 'Safe auto-approval could not be enabled.');
    } finally {
      setEnablingAutoApprove(false);
    }
  };

  useEffect(() => {
    denyRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onRespond('deny');
      if (event.key !== 'Tab') return;
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])');
      if (!controls?.length) return;
      const first = controls.item(0); const last = controls.item(controls.length - 1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onRespond]);

  return (
    <div
      onClick={stopProp}
      style={{ position: 'absolute', inset: 0, background: 'oklch(0 0 0 / .55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, backdropFilter: 'blur(2px)' }}
    >
      <div
        aria-modal="true"
        aria-labelledby="aur-approval-title"
        ref={dialogRef}
        role="dialog"
        style={{ width: 'min(620px, calc(100vw - 40px))', background: 'var(--bg-card)', border: `1px solid color-mix(in oklch, ${meta.color} 40%, transparent)`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 40px 90px -20px oklch(0 0 0 / .7)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: meta.color }} />
            <span id="aur-approval-title" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: meta.color, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              {meta.label} — approval required
            </span>
          </div>
          <button ref={denyRef} type="button" aria-label="Deny request" onClick={() => onRespond('deny')} style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '18px 20px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 10 }}>{request.tool}</div>
          <div style={{ background: 'var(--bg-deep)', borderRadius: 8, padding: '13px 15px', fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.85, marginBottom: 8, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: expanded ? '40vh' : 150, overflowY: 'auto' }}>
            <div style={{ color: 'var(--text)' }}>{request.pattern}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}><button type="button" className="aur-text-action" onClick={() => setExpanded((value) => !value)}>{expanded ? 'show less' : 'show full command'}</button><button type="button" className="aur-text-action" onClick={() => void navigator.clipboard.writeText(request.pattern).then(() => setCopied(true))}>{copied ? 'copied' : 'copy command'}</button></div>
          {(request.summary || request.reason) && (
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 14.5, lineHeight: 1.55, color: 'var(--text-muted)' }}>
              {request.summary ?? request.reason}
            </div>
          )}
          <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--control-bg)', borderRadius: 7, fontFamily: 'var(--font-mono)', fontSize: 10.5, lineHeight: 1.5, color: 'var(--text-muted)' }}>
            Allow once permits only this request. Auto-approve safe remembers only safe-level actions; writes, destructive commands, and warnings still require approval.
          </div>
          {autoApproveError && <div role="alert" className="aur-inline-error">{autoApproveError}</div>}
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '16px 20px', borderTop: '1px solid var(--border-subtle)' }}>
          <button
            onClick={() => onRespond('deny')}
            style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, padding: 11, background: 'transparent', color: 'var(--text)', border: '1px solid var(--border-strong)', borderRadius: 7, cursor: 'pointer' }}
          >
            deny
          </button>
          <button
            onClick={() => onRespond('allow_once')}
            style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, padding: 11, background: 'var(--safe)', color: 'var(--accent-ink)', border: 'none', borderRadius: 7, cursor: 'pointer' }}
          >
            allow once
          </button>
          <button
            disabled={!canAutoApprove || enablingAutoApprove}
            onClick={() => { void enableAutoApprove(); }}
            title={canAutoApprove ? 'Allow this and future safe actions automatically' : 'Only safe actions can be auto-approved'}
            style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, padding: 11, background: canAutoApprove ? 'var(--accent)' : 'var(--control-hover)', color: canAutoApprove ? 'var(--accent-ink)' : 'var(--text-subtle)', border: 'none', borderRadius: 7, cursor: canAutoApprove ? 'pointer' : 'not-allowed' }}
          >
            {enablingAutoApprove ? 'enabling…' : 'auto-approve safe'}
          </button>
        </div>
      </div>
    </div>
  );
}
