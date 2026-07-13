import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { SessionInfo } from '../../shared/ipc-types.js';

interface Props { sessions: SessionInfo[]; activeId: string | null; onSelect: (id: string) => void; onRename: (session: SessionInfo) => void; onBranch: (session: SessionInfo) => void; onArchive: (session: SessionInfo) => void; onRemove: (session: SessionInfo) => void; }

export function VirtualSessionList({ sessions, activeId, onSelect, onRename, onBranch, onArchive, onRemove }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({ count: sessions.length, getScrollElement: () => parentRef.current, estimateSize: () => 60, overscan: 8 });
  if (sessions.length === 0) return <div style={emptyStyle}>no sessions yet</div>;
  return <div ref={parentRef} style={scrollStyle}><div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>{virtualizer.getVirtualItems().map((row) => {
    const session = sessions[row.index]; if (!session) return null; const active = session.id === activeId;
    return <div key={session.id} ref={virtualizer.measureElement} data-index={row.index} style={{ position: 'absolute', inset: '0 0 auto', transform: `translateY(${row.start}px)`, padding: '0 8px 2px' }}><article role="button" tabIndex={0} onClick={() => onSelect(session.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(session.id); } }} style={{ ...itemStyle, opacity: session.status === 'archived' ? .6 : 1, background: active ? 'color-mix(in oklch, var(--accent) 12%, transparent)' : 'transparent', borderLeftColor: active ? 'var(--accent)' : 'transparent' }}><div style={rowStyle}><strong style={titleStyle}>{session.title ?? 'untitled session'}</strong><button type="button" aria-label={`Branch ${session.title ?? 'session'}`} onClick={(event) => { event.stopPropagation(); onBranch(session); }} style={buttonStyle}>⑂</button><button type="button" aria-label={`${session.status === 'archived' ? 'Restore' : 'Archive'} ${session.title ?? 'session'}`} onClick={(event) => { event.stopPropagation(); onArchive(session); }} style={buttonStyle}>{session.status === 'archived' ? '↶' : '⌑'}</button><button type="button" aria-label={`Rename ${session.title ?? 'session'}`} onClick={(event) => { event.stopPropagation(); onRename(session); }} style={buttonStyle}>↗</button><button type="button" aria-label={`Delete ${session.title ?? 'session'}`} onClick={(event) => { event.stopPropagation(); onRemove(session); }} style={buttonStyle}>×</button></div><small style={metaStyle}>{session.status === 'archived' ? 'archived · ' : ''}{relative(session.updatedAt)} · {session.turnCount} turns{session.lastModel ? ` · ${session.lastModel}` : ''}</small></article></div>;
  })}</div></div>;
}
function relative(time: number) { const minutes = Math.floor((Date.now() - time) / 60_000); return minutes < 1 ? 'now' : minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`; }
const scrollStyle: React.CSSProperties = { flex: 1, overflowY: 'auto', minHeight: 0 };
const emptyStyle: React.CSSProperties = { padding: '8px 18px', color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)', fontSize: 11.5 };
const itemStyle: React.CSSProperties = { padding: '9px 10px', borderRadius: 6, borderLeft: '2px solid', cursor: 'pointer' };
const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6 };
const titleStyle: React.CSSProperties = { flex: 1, overflow: 'hidden', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12.5, textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const metaStyle: React.CSSProperties = { display: 'block', marginTop: 2, color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)', fontSize: 10.5 };
const buttonStyle: React.CSSProperties = { minHeight: 20, padding: 0, color: 'var(--text-subtle)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10 };
