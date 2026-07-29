import React from 'react';
import type { FinanceConversation, FinanceResearchAudit } from '../../shared/ipc-types.js';

interface Props { conversation: FinanceConversation | null; audit?: FinanceResearchAudit; }

export function FinanceAuditPanel({ conversation, audit }: Props) {
  const current = audit ?? conversation?.audit;
  return <aside className="aur-finance-right" style={panelStyle}>
    <div style={eyebrowStyle}>integrity panel</div>
    {!conversation && <p style={emptyStyle}>Sources, data dates, and assumptions will appear here when you open a research conversation.</p>}
    {conversation && <>
      <AuditRow label="Status" value={statusText(conversation.status)} />
      {current?.dataAsOf && <AuditRow label="Data as of" value={formatDate(current.dataAsOf)} />}
      <AuditRow label="Sources" value={current ? `${current.sources.length} records` : 'Waiting for response'} />
      {current?.warning && <div role="alert" style={warningStyle}>{current.warning}</div>}
      {current?.sources.length ? <section style={sectionStyle}><h2 style={headingStyle}>Sources</h2>{current.sources.map((source) => <a key={`${source.title}-${source.url}`} href={source.url} target="_blank" rel="noreferrer" style={sourceStyle}>{source.title}<small>{source.publishedAt ? `Published: ${formatDate(source.publishedAt)}` : 'Publication date not provided'} · Accessed: {formatDate(source.accessedAt)}</small></a>)}</section> : null}
      <AuditList title="Assumptions" values={current?.assumptions ?? []} />
      <AuditList title="Uncertainties" values={current?.uncertainties ?? []} />
    </>}
  </aside>;
}

function AuditRow({ label, value }: { label: string; value: string }) { return <div style={rowStyle}><span>{label}</span><strong>{value}</strong></div>; }
function AuditList({ title, values }: { title: string; values: string[] }) { return values.length ? <section style={sectionStyle}><h2 style={headingStyle}>{title}</h2><ul style={listStyle}>{values.map((value) => <li key={value}>{value}</li>)}</ul></section> : null; }
function formatDate(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-US'); }
function statusText(status: FinanceConversation['status']): string { return ({ active: 'Working', complete: 'Complete', 'needs-review': 'Needs review', failed: 'Failed', cancelled: 'Cancelled' })[status]; }

const panelStyle: React.CSSProperties = { width: 286, minWidth: 286, overflowY: 'auto', padding: 18, background: 'var(--bg-alt)', borderLeft: '1px solid var(--border-subtle)' };
const eyebrowStyle: React.CSSProperties = { marginBottom: 14, fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--accent)' };
const emptyStyle: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.55, color: 'var(--text-subtle)' };
const rowStyle: React.CSSProperties = { display: 'grid', gap: 3, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-subtle)' };
const warningStyle: React.CSSProperties = { marginTop: 13, padding: 10, borderRadius: 6, color: 'var(--warning)', background: 'color-mix(in oklch, var(--warning) 10%, transparent)', fontFamily: 'var(--font-mono)', fontSize: 10.5, lineHeight: 1.5 };
const sectionStyle: React.CSSProperties = { marginTop: 18 };
const headingStyle: React.CSSProperties = { margin: '0 0 7px', fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-subtle)' };
const sourceStyle: React.CSSProperties = { display: 'grid', gap: 3, padding: '7px 0', color: 'var(--accent)', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: 10.5, overflowWrap: 'anywhere' };
const listStyle: React.CSSProperties = { margin: 0, paddingLeft: 16, fontFamily: 'var(--font-mono)', fontSize: 10.5, lineHeight: 1.55, color: 'var(--text-muted)' };
