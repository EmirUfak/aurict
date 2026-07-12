import React, { useState } from 'react';
import type { FinanceCalculationResult } from '../../shared/ipc-types.js';
import { buildFinanceRequest, calculators, initialValues, type CalculatorDefinition } from './calculator-config.js';
import { CalculationResult } from './CalculationResult.js';

interface Props {
  onCalculated: () => Promise<void>;
}

function firstCalculator(): CalculatorDefinition {
  const calculator = calculators[0];
  if (!calculator) throw new Error('Finance calculator definitions are unavailable');
  return calculator;
}

const initialCalculator = firstCalculator();

export function CalculationDesk({ onCalculated }: Props) {
  const [selectedId, setSelectedId] = useState(initialCalculator.id);
  const [values, setValues] = useState(() => initialValues(initialCalculator));
  const [result, setResult] = useState<FinanceCalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const selected = calculators.find((calculator) => calculator.id === selectedId) ?? initialCalculator;

  const selectCalculator = (id: string) => {
    const next = calculators.find((calculator) => calculator.id === id);
    if (!next) return;
    setSelectedId(next.id);
    setValues(initialValues(next));
    setResult(null);
    setError(null);
  };
  const resetForm = () => {
    setValues(initialValues(selected));
    setResult(null);
    setError(null);
  };

  const calculate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const next = await window.aurict.finance.calculate(buildFinanceRequest(selected.id, values));
      setResult(next);
      await onCalculated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setPending(false);
    }
  };

  return <div style={{ maxWidth: 900 }}>
    <div style={eyebrow}>Calculations</div>
    <h1 style={titleStyle}>Transparent calculations, never unexplained numbers.</h1>
    <p style={subtitleStyle}>Calculations run in Aurict’s deterministic decimal engine. The result records its formula version, precision, inputs, assumptions, warnings, and timestamp locally.</p>
    <div className="aur-calculation-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(190px, .7fr) minmax(0, 1.5fr)', gap: 18, marginTop: 25 }}>
      <nav aria-label="Calculation type" style={navStyle}>{calculators.map((calculator) => <button key={calculator.id} type="button" aria-pressed={selected.id === calculator.id} onClick={() => selectCalculator(calculator.id)} style={{ ...choiceStyle, ...(selected.id === calculator.id ? selectedChoiceStyle : {}) }}><span>{calculator.title}</span><small>{calculator.detail}</small></button>)}</nav>
      <form onSubmit={(event) => { void calculate(event); }} style={formStyle}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--text)' }}>{selected.title}</div>
        <p style={{ margin: '6px 0 18px', fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.5, color: 'var(--text-muted)' }}>{selected.detail}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 13 }}>
          {selected.fields.map((field) => <label key={field.name} style={{ display: 'grid', gap: 6, gridColumn: field.name === 'cashFlows' || field.name === 'freeCashFlows' ? '1 / -1' : undefined }}>
            <span style={labelStyle}>{field.label}{field.optional ? ' · optional' : ''}</span>
            {field.name === 'cashFlows' || field.name === 'freeCashFlows'
              ? <textarea required={!field.optional} value={values[field.name] ?? ''} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} placeholder={field.placeholder} rows={5} style={textareaStyle} />
              : <input required={!field.optional} inputMode={field.integer ? 'numeric' : 'decimal'} value={values[field.name] ?? ''} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} placeholder={field.placeholder} style={inputStyle} />}
            {field.help && <span style={helpStyle}>{field.help}</span>}
          </label>)}
        </div>
        {error && <div role="alert" style={errorStyle}>{error}</div>}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 11, marginTop: 20 }}><button type="submit" disabled={pending} style={primaryButton}>{pending ? 'calculating…' : 'run calculation →'}</button><button type="button" className="aur-button" onClick={resetForm}>reset form</button><span style={helpStyle}>Saved to local calculation history after a successful run.</span></div>
      </form>
    </div>
    {result && <CalculationResult result={result} />}
  </div>;
}

const eyebrow: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--accent)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 };
const titleStyle: React.CSSProperties = { margin: 0, fontFamily: 'var(--font-serif)', fontSize: 31, lineHeight: 1.12, color: 'var(--text)' };
const subtitleStyle: React.CSSProperties = { maxWidth: 720, margin: '12px 0 0', fontFamily: 'var(--font-serif)', fontSize: 16, lineHeight: 1.55, color: 'var(--text-muted)' };
const navStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignSelf: 'start', gap: 4, padding: 7, background: 'var(--bg-alt)', border: '1px solid var(--border-subtle)', borderRadius: 9 };
const choiceStyle: React.CSSProperties = { display: 'grid', gap: 4, padding: '10px 11px', textAlign: 'left', color: 'var(--text-muted)', background: 'transparent', border: '1px solid transparent', borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11.5 };
const selectedChoiceStyle: React.CSSProperties = { color: 'var(--text)', background: 'color-mix(in oklch, var(--accent) 13%, transparent)', borderColor: 'color-mix(in oklch, var(--accent) 26%, transparent)' };
const formStyle: React.CSSProperties = { padding: 19, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 10 };
const labelStyle: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)' };
const helpStyle: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 10.5, lineHeight: 1.45, color: 'var(--text-subtle)' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 10px', color: 'var(--text)', background: 'var(--control-bg)', border: '1px solid var(--border-strong)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 12 };
const textareaStyle: React.CSSProperties = { ...inputStyle, resize: 'vertical', lineHeight: 1.5 };
const primaryButton: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, padding: '10px 14px', color: 'var(--accent-ink)', background: 'var(--accent)', border: 'none', borderRadius: 7, cursor: 'pointer' };
const errorStyle: React.CSSProperties = { marginTop: 16, padding: 10, color: 'var(--danger)', background: 'color-mix(in oklch, var(--danger) 11%, transparent)', border: '1px solid color-mix(in oklch, var(--danger) 35%, transparent)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.5 };
