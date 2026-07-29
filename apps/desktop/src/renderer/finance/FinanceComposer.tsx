import React, { useState } from 'react';
import { ModelSelector } from '../components/ModelSelector.js';

interface Props { disabled: boolean; pending: boolean; statusMessage: string | null; onSubmit: (question: string) => boolean; onCancel: () => void; }

export function FinanceComposer({ disabled, pending, statusMessage, onSubmit, onCancel }: Props) {
  const [draft, setDraft] = useState('');
  const send = () => { if (onSubmit(draft)) setDraft(''); };
  return <div style={wrapperStyle}><div style={composerStyle}><textarea value={draft} disabled={disabled || pending} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder={disabled ? 'Start a new finance research conversation first…' : 'Ask about bonds, TLREF, yields, or a financial scenario…'} rows={2} style={textareaStyle} /><button type="button" disabled={disabled || (!pending && !draft.trim())} onClick={pending ? onCancel : send} style={buttonStyle}>{pending ? 'cancel' : 'send ↵'}</button></div><div style={footerStyle}><span>{pending ? statusMessage ?? 'Finance Desk is working…' : 'Enter to send · Shift+Enter for a new line'}</span><ModelSelector /></div></div>;
}

const wrapperStyle: React.CSSProperties = { padding: '14px 28px 18px', borderTop: '1px solid var(--border-subtle)' };
const composerStyle: React.CSSProperties = { display: 'flex', alignItems: 'flex-end', gap: 10, maxWidth: 860, margin: '0 auto', padding: '10px 10px 10px 15px', background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 10 };
const textareaStyle: React.CSSProperties = { flex: 1, minWidth: 0, resize: 'vertical', fontFamily: 'var(--font-serif)', fontSize: 15, lineHeight: 1.5, color: 'var(--text)', background: 'transparent', border: 'none' };
const buttonStyle: React.CSSProperties = { padding: '9px 14px', color: 'var(--accent-ink)', background: 'var(--accent)', border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap' };
const footerStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, maxWidth: 860, margin: '7px auto 0', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-subtle)' };
