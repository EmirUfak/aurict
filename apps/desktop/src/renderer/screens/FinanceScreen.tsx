import React, { useEffect, useState } from 'react';
import type { useChat } from '../hooks/useChat.js';
import type { FinanceCalculationEntry, FinanceResearchEntry } from '../../shared/ipc-types.js';
import { CalculationDesk } from '../finance/CalculationDesk.js';
import { FinanceHistory } from '../finance/FinanceHistory.js';
import { ModelSelector } from '../components/ModelSelector.js';

type FinanceTab = 'research' | 'calculate' | 'history';

interface Props {
  chat: ReturnType<typeof useChat>;
  onLaunched: () => void;
}

const TABS: Array<{ id: FinanceTab; label: string }> = [
  { id: 'research', label: 'research' },
  { id: 'calculate', label: 'calculate' },
  { id: 'history', label: 'history' },
];

export function FinanceScreen({ chat, onLaunched }: Props) {
  const [tab, setTab] = useState<FinanceTab>('research');
  const [draft, setDraft] = useState('');
  const [research, setResearch] = useState<FinanceResearchEntry[]>([]);
  const [calculations, setCalculations] = useState<FinanceCalculationEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refreshHistory = async () => {
    const [nextResearch, nextCalculations] = await Promise.all([
      window.aurict.finance.listResearch(),
      window.aurict.finance.listCalculations(),
    ]);
    setResearch(nextResearch);
    setCalculations(nextCalculations);
  };

  useEffect(() => { void refreshHistory().catch((loadError) => { console.error('Failed to load finance history', loadError); setError(loadError instanceof Error ? loadError.message : 'Finance history could not be loaded.'); }); }, []);

  const launch = async () => {
    const question = draft.trim();
    if (!question || chat.pending) return;
    setError(null);
    const research = await window.aurict.finance.createResearch(question);
    await refreshHistory();
    chat.submit(`Finance & Research request: ${question}\n\nIf current or external facts are needed, cite primary sources and include each source's publication date, access time, data-as-of date, currency, assumptions, and material uncertainties. If a calculation is needed, use the finance_calculate tool for deterministic math and preserve its returned formula, inputs, precision, assumptions, and warnings before presenting a result. Do not present personalized financial advice. End the response with exactly one \`\`\`finance-audit code block containing valid JSON: {"summary":"...","dataAsOf":"ISO date/time when applicable","sources":[{"title":"...","url":"https://...","publishedAt":"ISO date/time when known"}],"assumptions":["..."],"uncertainties":["..."]}. Use an empty sources array only when no external facts were used.`, undefined, undefined, `Finance research: ${question}`, undefined, undefined, research.id);
    setDraft('');
    onLaunched();
  };

  return <div className="aur-finance-layout" style={{ flex: 1, display: 'flex', minHeight: 0, background: 'var(--bg)' }}>
    <aside className="aur-finance-left" style={leftRailStyle}><div style={railEyebrow}>Finance desk</div><div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{TABS.map((item) => <button key={item.id} aria-pressed={tab === item.id} onClick={() => setTab(item.id)} style={{ ...tabStyle, ...(tab === item.id ? activeTabStyle : {}) }}>{item.label}</button>)}</div><div style={{ marginTop: 28, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}><div style={railNoteStyle}>Deterministic results retain inputs, formula, assumptions, warnings, and calculation date.</div></div></aside>
    <main className="aur-finance-main" style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '38px 42px' }}>
      {error && <div role="alert" className="aur-inline-error">{error} <button type="button" className="aur-text-action" onClick={() => { setError(null); void refreshHistory().catch((reason) => setError(reason instanceof Error ? reason.message : String(reason))); }}>retry</button></div>}
      {tab === 'research' && <ResearchDesk draft={draft} setDraft={setDraft} launch={() => { void launch().catch((launchError) => { console.error('Failed to save finance research request', launchError); setError(launchError instanceof Error ? launchError.message : 'Finance research could not be started.'); }); }} pending={chat.pending} />}
      {tab === 'calculate' && <CalculationDesk onCalculated={refreshHistory} />}
      {tab === 'history' && <FinanceHistory calculations={calculations} research={research} onRemoveCalculation={async (id) => { await window.aurict.finance.removeCalculation(id); await refreshHistory(); }} onRemoveResearch={async (id) => { await window.aurict.finance.removeResearch(id); await refreshHistory(); }} />}
    </main>
    <aside className="aur-finance-right" style={rightRailStyle}><div style={railEyebrow}>Integrity panel</div><IntegrityRow label="Source citations" detail="Required for external facts" /><IntegrityRow label="Data as of" detail="Shown beside market data" /><IntegrityRow label="Formula trail" detail="Inputs and assumptions retained" /><IntegrityRow label="Advice boundary" detail="Analysis, not personalized advice" /></aside>
  </div>;
}

function ResearchDesk({ draft, setDraft, launch, pending }: { draft: string; setDraft: (value: string) => void; launch: () => void; pending: boolean }) {
  return <div style={{ maxWidth: 800 }}><div style={eyebrow}>Research</div><h1 style={titleStyle}>Ask a financial question with an audit trail.</h1><p style={subtitleStyle}>Aurict can research concepts, companies, markets, rates, and instruments. Any time-sensitive result should name its sources and dates.</p><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); launch(); } }} placeholder="e.g. Compare a 5-year bond’s sensitivity if yields rise by 50 bps" rows={4} style={researchInputStyle} /><div style={{ display: 'flex', gap: 8, marginTop: 10 }}><button onClick={launch} disabled={!draft.trim() || pending} style={primaryButton}>{pending ? 'working…' : 'research with sources →'}</button></div><ModelSelector /><div className="aur-finance-prompts" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 30 }}><PromptCard title="Bond analysis" text="Price, yield, duration, and interest-rate scenarios." prompt="Compare a 5-year bond’s price, yield, duration, and sensitivity if yields rise by 50 basis points." onSelect={setDraft} /><PromptCard title="Company research" text="Primary sources, key assumptions, and uncertainties." prompt="Research this company using primary sources. State source dates, key assumptions, and material uncertainties." onSelect={setDraft} /><PromptCard title="Explain a formula" text="Step-by-step math with a reusable calculation trail." prompt="Explain this financial formula step by step and show a transparent calculation with assumptions." onSelect={setDraft} /></div></div>;
}

function PromptCard({ title, text, prompt, onSelect }: { title: string; text: string; prompt: string; onSelect: (value: string) => void }) { return <button type="button" onClick={() => onSelect(prompt)} style={{ ...promptCardStyle, cursor: 'pointer', textAlign: 'left' }}><div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--text)', marginBottom: 6 }}>{title}</div><div style={railNoteStyle}>{text}</div></button>; }
function IntegrityRow({ label, detail }: { label: string; detail: string }) { return <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}><div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text)' }}>{label}</div><div style={{ marginTop: 3, ...railNoteStyle }}>{detail}</div></div>; }

const leftRailStyle: React.CSSProperties = { width: 232, minWidth: 232, padding: 16, background: 'var(--bg-alt)', borderRight: '1px solid var(--border-subtle)' };
const rightRailStyle: React.CSSProperties = { width: 280, minWidth: 280, padding: 18, background: 'var(--bg-alt)', borderLeft: '1px solid var(--border-subtle)' };
const railEyebrow: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '.08em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 14 };
const railNoteStyle: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 10.5, lineHeight: 1.55, color: 'var(--text-subtle)' };
const tabStyle: React.CSSProperties = { textAlign: 'left', padding: '9px 10px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', background: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer' };
const activeTabStyle: React.CSSProperties = { color: 'var(--text)', background: 'color-mix(in oklch, var(--accent) 14%, transparent)' };
const eyebrow: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--accent)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 };
const titleStyle: React.CSSProperties = { margin: 0, fontFamily: 'var(--font-serif)', fontSize: 31, lineHeight: 1.12, color: 'var(--text)' };
const subtitleStyle: React.CSSProperties = { maxWidth: 650, margin: '12px 0 0', fontFamily: 'var(--font-serif)', fontSize: 16, lineHeight: 1.55, color: 'var(--text-muted)' };
const researchInputStyle: React.CSSProperties = { width: '100%', resize: 'vertical', padding: 14, marginTop: 22, fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--text)', background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 9 };
const primaryButton: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, padding: '10px 14px', color: 'var(--accent-ink)', background: 'var(--accent)', border: 'none', borderRadius: 7, cursor: 'pointer' };
const promptCardStyle: React.CSSProperties = { minHeight: 102, padding: 15, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8 };
