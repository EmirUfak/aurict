import React from 'react';
import type { SessionInfo } from '../../shared/ipc-types.js';

export function SessionMetadata({ session }: { session: SessionInfo }) {
  const totalTokens = session.totalInputTokens + session.totalOutputTokens + session.totalCacheTokens;
  return <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-subtle)', display: 'grid', gap: 4 }}><div style={eyebrowStyle}>session metadata</div><div style={metaStyle}>status: {session.status} · updated {formatRelativeTime(session.updatedAt)}</div><div style={metaStyle}>{session.provider ?? 'provider unknown'} · {session.lastModel ?? 'model pending'}</div><div style={metaStyle}>{totalTokens.toLocaleString()} tokens · ${session.accumulatedCostUsd.toFixed(4)} cost</div>{session.parentId && <div style={subtleStyle}>child of {session.parentId.slice(0, 12)}</div>}</div>;
}

export function PanelTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, padding: '8px 4px', marginRight: 16, border: 'none', borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`, cursor: 'pointer', background: 'transparent', color: active ? 'var(--text)' : 'var(--text-muted)' }}>{label}</button>;
}

export function CenterTab({ label, active, dirty, onClick, onClose }: { label: string; active: boolean; dirty?: boolean; onClick: () => void; onClose?: () => void }) {
  return <div onClick={onClick} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick(); } }} aria-selected={active} role="tab" tabIndex={0} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', marginRight: 2, borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`, cursor: 'pointer', whiteSpace: 'nowrap' }}>{dirty && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 600, color: active ? 'var(--text)' : 'var(--text-muted)' }}>{label}</span>{onClose && <button aria-label={`Close ${label}`} onClick={(event) => { event.stopPropagation(); onClose(); }} style={{ minHeight: 20, padding: 0, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-subtle)', background: 'transparent', border: 'none', cursor: 'pointer' }}>×</button>}</div>;
}

function formatRelativeTime(ms: number): string { const minutes = Math.floor((Date.now() - ms) / 60_000); if (minutes < 1) return 'just now'; if (minutes < 60) return `${minutes}m ago`; const hours = Math.floor(minutes / 60); return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`; }
const eyebrowStyle: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-subtle)' };
const metaStyle: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 10.5, lineHeight: 1.45, color: 'var(--text-muted)' };
const subtleStyle: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-subtle)' };
