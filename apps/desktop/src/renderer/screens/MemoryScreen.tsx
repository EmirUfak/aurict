import React, { useState } from 'react';
import { useMemory } from '../hooks/useMemory.js';
import type { MemoryCategory, MemoryScope, MemoryInfo } from '../../shared/ipc-types.js';

const sectionHeading: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase',
  color: 'var(--text-subtle)', marginBottom: 12,
};

const CATEGORIES: MemoryCategory[] = ['preference', 'project', 'fact', 'decision', 'pattern'];
const CATEGORY_COLOR: Record<MemoryCategory, string> = {
  preference: 'var(--accent)',
  project: 'var(--safe)',
  fact: 'var(--text-muted)',
  decision: 'var(--warning)',
  pattern: 'var(--accent)',
};

function formatDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function MemoryScreen() {
  const memory = useMemory();
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<MemoryCategory>('fact');
  const [scope, setScope] = useState<MemoryScope>('project');

  const handleAdd = () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    memory.add(trimmed, category, scope);
    setContent('');
  };

  const project = memory.memories.filter((m) => m.scope === 'project');
  const global = memory.memories.filter((m) => m.scope === 'global');

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 32px 64px' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 28, color: 'var(--text)', margin: '0 0 6px' }}>
          Memory
        </h1>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 28px' }}>
          Persistent facts, preferences, and decisions aurict remembers across sessions — the same store the agent uses via its own memory tool.
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="Remember something…"
            style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12.5, padding: '9px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 7, color: 'var(--text)' }}
          />
          <select value={category} onChange={(e) => setCategory(e.target.value as MemoryCategory)} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 7, padding: '0 8px' }}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={scope} onChange={(e) => setScope(e.target.value as MemoryScope)} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 7, padding: '0 8px' }}>
            <option value="project">project</option>
            <option value="global">global</option>
          </select>
          <button
            onClick={handleAdd}
            disabled={!content.trim()}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 600, padding: '9px 16px', background: content.trim() ? 'var(--accent)' : 'var(--control-hover)', color: content.trim() ? 'var(--accent-ink)' : 'var(--text-subtle)', border: 'none', borderRadius: 7, cursor: content.trim() ? 'pointer' : 'default' }}
          >
            remember
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 12 }}>
          <div style={sectionHeading}>project ({project.length})</div>
          {project.length > 0 && (
            <button type="button" onClick={() => memory.clear('project')} style={{ minHeight: 24, padding: 0, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--danger)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
              clear project memories
            </button>
          )}
        </div>
        <MemoryList entries={project} onRemove={memory.remove} />

        <div style={{ ...sectionHeading, marginTop: 28 }}>global ({global.length})</div>
        <MemoryList entries={global} onRemove={memory.remove} />
      </div>
    </div>
  );
}

function MemoryList({ entries, onRemove }: { entries: MemoryInfo[]; onRemove: (id: string) => void }) {
  if (entries.length === 0) {
    return (
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-subtle)', padding: '8px 0' }}>
        nothing remembered yet
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--control-bg)', borderRadius: 8, overflow: 'hidden' }}>
      {entries.map((m) => (
        <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, padding: '12px 16px', background: 'var(--bg-card)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, color: CATEGORY_COLOR[m.category], textTransform: 'uppercase', letterSpacing: '.04em' }}>{m.category}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-subtle)' }}>{formatDate(m.timestamp)} · {m.source}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 14.5, color: 'var(--text)', lineHeight: 1.5 }}>{m.content}</div>
          </div>
          <button type="button" aria-label={`Remove memory: ${m.content}`} onClick={() => onRemove(m.id)} style={{ padding: 0, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-subtle)', background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0 }}>×</button>
        </div>
      ))}
    </div>
  );
}
