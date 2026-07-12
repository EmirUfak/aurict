import React, { useState } from 'react';
import type { FinanceCalculationResult } from '../../shared/ipc-types.js';

function labelFor(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
}

function Value({ value }: { value: unknown }) {
  if (Array.isArray(value)) return <details><summary>{value.length} rows</summary><pre style={jsonStyle}>{JSON.stringify(value, null, 2)}</pre></details>;
  if (typeof value === 'object' && value !== null) return <pre style={jsonStyle}>{JSON.stringify(value, null, 2)}</pre>;
  return <span>{String(value)}</span>;
}

export function CalculationResult({ result }: { result: FinanceCalculationResult }) {
  const [copied, setCopied] = useState(false);
  const copyTrail = () => {
    void navigator.clipboard.writeText(JSON.stringify(result, null, 2)).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_800);
    }).catch((reason: unknown) => console.error('Failed to copy calculation trail', reason));
  };
  return <section aria-live="polite" style={panelStyle}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'baseline' }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 19, color: 'var(--text)' }}>Calculation result</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><div style={metaStyle}>saved locally</div><button type="button" onClick={copyTrail} style={copyButtonStyle}>{copied ? 'copied' : 'copy record'}</button></div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 9, marginTop: 15 }}>
      {Object.entries(result.outputs).map(([key, value]) => <div key={key} style={outputStyle}><div style={metaStyle}>{labelFor(key)}</div><div style={{ marginTop: 5, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text)', overflowWrap: 'anywhere' }}><Value value={value} /></div></div>)}
    </div>
    <details style={{ marginTop: 16 }}><summary style={summaryStyle}>Calculation trail</summary><Trail result={result} /></details>
  </section>;
}

function Trail({ result }: { result: FinanceCalculationResult }) {
  return <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
    <div><div style={metaStyle}>Formula and precision</div><div style={bodyStyle}>{result.calculation} · v{result.formulaVersion} · {result.precision.decimalPlaces} decimal places · {result.precision.rounding}</div></div>
    <div><div style={metaStyle}>Calculated at</div><div style={bodyStyle}>{new Date(result.calculatedAt).toLocaleString()}</div></div>
    <div><div style={metaStyle}>Inputs</div><pre style={jsonStyle}>{JSON.stringify(result.inputs, null, 2)}</pre></div>
    <div><div style={metaStyle}>Assumptions</div><ul style={listStyle}>{result.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul></div>
    {result.warnings.length > 0 && <div><div style={metaStyle}>Warnings</div><ul style={listStyle}>{result.warnings.map((warning) => <li key={warning.code}>{warning.message}</li>)}</ul></div>}
  </div>;
}

const panelStyle: React.CSSProperties = { marginTop: 22, padding: 18, background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 10 };
const outputStyle: React.CSSProperties = { padding: 11, background: 'var(--control-bg)', borderRadius: 7, minWidth: 0 };
const metaStyle: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '.04em', color: 'var(--text-subtle)', textTransform: 'uppercase' };
const bodyStyle: React.CSSProperties = { marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.55, color: 'var(--text-muted)' };
const jsonStyle: React.CSSProperties = { margin: '7px 0 0', padding: 10, overflowX: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.5, color: 'var(--text-muted)', background: 'var(--bg-deep)', borderRadius: 6 };
const summaryStyle: React.CSSProperties = { cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--accent)' };
const listStyle: React.CSSProperties = { margin: '6px 0 0', paddingLeft: 18, fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.55, color: 'var(--text-muted)' };
const copyButtonStyle: React.CSSProperties = { minHeight: 22, padding: '2px 5px', color: 'var(--accent)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10.5 };
