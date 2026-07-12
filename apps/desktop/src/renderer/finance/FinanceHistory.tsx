import React, { useEffect, useState } from 'react';
import type { FinanceCalculationEntry, FinanceResearchAudit, FinanceResearchEntry } from '../../shared/ipc-types.js';
import { CalculationResult } from './CalculationResult.js';
import { ConfirmDialog } from '../components/Dialog.js';

interface Props {
  calculations: FinanceCalculationEntry[];
  research: FinanceResearchEntry[];
  onRemoveCalculation: (id: string) => Promise<void>;
  onRemoveResearch: (id: string) => Promise<void>;
}

export function FinanceHistory({ calculations, research, onRemoveCalculation, onRemoveResearch }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(calculations[0]?.id ?? null);
  const [removal, setRemoval] = useState<{ kind: 'calculation' | 'research'; id: string; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selected = calculations.find((entry) => entry.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedId && calculations.some((entry) => entry.id === selectedId)) return;
    setSelectedId(calculations[0]?.id ?? null);
  }, [calculations, selectedId]);

  const confirmRemoval = async () => {
    if (!removal) return;
    const item = removal;
    setRemoval(null);
    setError(null);
    try {
      if (item.kind === 'calculation') {
        await onRemoveCalculation(item.id);
        setSelectedId(null);
      } else {
        await onRemoveResearch(item.id);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'This history record could not be removed.');
    }
  };

  return <div style={{ maxWidth: 900 }}>
    <div style={eyebrow}>History</div>
    <h1 style={titleStyle}>Reusable research and calculations.</h1>
    <p style={subtitleStyle}>Each calculation is retained with its exact inputs, output, assumptions, warnings, precision, and timestamp. Research requests remain separate because external sources must be evaluated by the model and cited in its response.</p>
    {error && <div className="aur-inline-error" role="alert">{error}</div>}
    <section style={{ marginTop: 27 }}><div style={sectionTitle}>Calculations</div>
      {calculations.length === 0 ? <Empty text="No deterministic calculations saved yet." /> : <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, .8fr) minmax(0, 1.2fr)', gap: 14, marginTop: 11 }}>
        <div style={listStyle}>{calculations.map((entry) => <button key={entry.id} type="button" onClick={() => setSelectedId(entry.id)} style={{ ...entryStyle, ...(entry.id === selected?.id ? selectedEntryStyle : {}) }}><span>{labelFor(entry.result.calculation)}</span><small>{new Date(entry.savedAt).toLocaleString()}</small></button>)}</div>
        <div>{selected && <><CalculationResult result={selected.result} /><button type="button" onClick={() => setRemoval({ kind: 'calculation', id: selected.id, label: labelFor(selected.result.calculation) })} style={removeButton}>remove this calculation</button></>}</div>
      </div>}
    </section>
    <section style={{ marginTop: 32 }}><div style={sectionTitle}>Research requests</div>
      {research.length === 0 ? <Empty text="No saved finance research requests yet." /> : <div style={{ display: 'grid', gap: 8, marginTop: 11 }}>{research.map((entry) => <div key={entry.id} style={researchStyle}><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--text)' }}>{entry.question}</div><div style={metaStyle}>{new Date(entry.createdAt).toLocaleString()} · {entry.status}{entry.dataAsOf ? ` · data as of ${entry.dataAsOf}` : ''}</div>{entry.audit ? <ResearchAudit audit={entry.audit} /> : <div style={{ ...metaStyle, color: entry.status === 'researching' ? 'var(--warning)' : 'var(--danger)' }}>{entry.status === 'researching' ? 'Awaiting a completed research response.' : 'No structured source audit was captured; review the chat response.'}</div>}</div><button aria-label={`Remove ${entry.question}`} type="button" onClick={() => setRemoval({ kind: 'research', id: entry.id, label: entry.question })} style={removeIconButton}>×</button></div>)}</div>}
    </section>
    {removal && <ConfirmDialog title="Remove history record?" description={`Remove ${removal.label} from this device’s local finance history? This cannot be undone.`} confirmLabel="Remove record" tone="danger" onCancel={() => setRemoval(null)} onConfirm={() => { void confirmRemoval(); }} />}
  </div>;
}

function Empty({ text }: { text: string }) {
  return <div style={{ marginTop: 11, padding: 16, border: '1px dashed var(--border-strong)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-subtle)' }}>{text}</div>;
}

function ResearchAudit({ audit }: { audit: FinanceResearchAudit }) {
  return <details style={{ marginTop: 10 }}><summary style={auditSummaryStyle}>audit trail · {audit.sources.length} source{audit.sources.length === 1 ? '' : 's'}</summary><div style={auditBodyStyle}><div>{audit.summary}</div>{audit.warning && <div style={{ color: 'var(--warning)' }}>{audit.warning}</div>}{audit.sources.length > 0 && <div><div style={auditLabelStyle}>Sources</div>{audit.sources.map((source) => <a key={`${source.title}-${source.url}`} href={source.url} target="_blank" rel="noreferrer" style={sourceStyle}>{source.title}{source.publishedAt ? ` · published ${source.publishedAt}` : ''}{` · accessed ${source.accessedAt}`}</a>)}</div>}{audit.assumptions.length > 0 && <AuditList label="Assumptions" items={audit.assumptions} />}{audit.uncertainties.length > 0 && <AuditList label="Uncertainties" items={audit.uncertainties} />}</div></details>;
}

function AuditList({ label, items }: { label: string; items: string[] }) {
  return <div><div style={auditLabelStyle}>{label}</div><ul style={{ margin: '4px 0 0', paddingLeft: 17 }}>{items.map((item) => <li key={item}>{item}</li>)}</ul></div>;
}

function labelFor(value: string): string {
  return value.replaceAll('_', ' ');
}

const eyebrow: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--accent)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 };
const titleStyle: React.CSSProperties = { margin: 0, fontFamily: 'var(--font-serif)', fontSize: 31, lineHeight: 1.12, color: 'var(--text)' };
const subtitleStyle: React.CSSProperties = { maxWidth: 740, margin: '12px 0 0', fontFamily: 'var(--font-serif)', fontSize: 16, lineHeight: 1.55, color: 'var(--text-muted)' };
const sectionTitle: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.07em', color: 'var(--accent)', textTransform: 'uppercase' };
const listStyle: React.CSSProperties = { display: 'grid', alignContent: 'start', gap: 5, padding: 7, background: 'var(--bg-alt)', border: '1px solid var(--border-subtle)', borderRadius: 8 };
const entryStyle: React.CSSProperties = { display: 'grid', gap: 4, padding: '10px 11px', textAlign: 'left', color: 'var(--text-muted)', background: 'transparent', border: '1px solid transparent', borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11.5 };
const selectedEntryStyle: React.CSSProperties = { color: 'var(--text)', background: 'color-mix(in oklch, var(--accent) 13%, transparent)', borderColor: 'color-mix(in oklch, var(--accent) 26%, transparent)' };
const metaStyle: React.CSSProperties = { marginTop: 5, fontFamily: 'var(--font-mono)', fontSize: 10.5, lineHeight: 1.45, color: 'var(--text-subtle)' };
const researchStyle: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 14, padding: 14, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8 };
const removeButton: React.CSSProperties = { marginTop: 8, padding: 0, color: 'var(--danger)', background: 'transparent', border: 'none', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' };
const removeIconButton: React.CSSProperties = { color: 'var(--text-muted)', background: 'transparent', border: 'none', fontSize: 20, lineHeight: 1, cursor: 'pointer' };
const auditSummaryStyle: React.CSSProperties = { cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--accent)' };
const auditBodyStyle: React.CSSProperties = { display: 'grid', gap: 9, marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 10.5, lineHeight: 1.55, color: 'var(--text-muted)' };
const auditLabelStyle: React.CSSProperties = { color: 'var(--text-subtle)', letterSpacing: '.04em', textTransform: 'uppercase' };
const sourceStyle: React.CSSProperties = { display: 'block', marginTop: 4, color: 'var(--accent)', overflowWrap: 'anywhere' };
