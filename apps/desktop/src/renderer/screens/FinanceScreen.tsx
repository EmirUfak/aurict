import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { FinanceConversation } from '../../shared/ipc-types.js';
import { ChatTimeline } from '../components/ChatTimeline.js';
import { ConfirmDialog } from '../components/Dialog.js';
import { FinanceAuditPanel } from '../finance/FinanceAuditPanel.js';
import { FinanceComposer } from '../finance/FinanceComposer.js';
import { FinanceConversationList } from '../finance/FinanceConversationList.js';
import { useFinanceChat } from '../hooks/useFinanceChat.js';

export function FinanceScreen() {
  const finance = useFinanceChat();
  const [conversations, setConversations] = useState<FinanceConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removal, setRemoval] = useState<FinanceConversation | null>(null);

  const selected = useMemo(() => conversations.find((conversation) => conversation.id === selectedId) ?? null, [conversations, selectedId]);
  const refresh = useCallback(async () => {
    const next = await window.aurict.finance.listConversations();
    setConversations(next);
    setSelectedId((current) => current && next.some((conversation) => conversation.id === current) ? current : next[0]?.id ?? null);
  }, []);

  const select = useCallback((id: string) => {
    const conversation = conversations.find((item) => item.id === id);
    if (!conversation || finance.pending) return;
    setSelectedId(id);
    finance.loadConversation(conversation);
  }, [conversations, finance.loadConversation, finance.pending]);

  useEffect(() => { void refresh().catch((reason) => setError(reason instanceof Error ? reason.message : String(reason))); }, [refresh]);
  useEffect(() => { if (!finance.pending) void refresh().catch((reason) => setError(reason instanceof Error ? reason.message : String(reason))); }, [finance.pending, refresh]);
  useEffect(() => { if (selected && finance.messages.length === 0 && !finance.pending) finance.loadConversation(selected); }, [finance.loadConversation, finance.messages.length, finance.pending, selected]);

  const create = async () => {
    if (finance.pending) return;
    try {
      const conversation = await window.aurict.finance.createConversation();
      setConversations((current) => [conversation, ...current]);
      setSelectedId(conversation.id);
      finance.loadConversation(conversation);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const remove = async () => {
    if (!removal) return;
    try {
      await window.aurict.finance.removeConversation(removal.id);
      const next = conversations.filter((conversation) => conversation.id !== removal.id);
      setConversations(next);
      const nextId = selectedId === removal.id ? next[0]?.id ?? null : selectedId;
      setSelectedId(nextId);
      finance.loadConversation(next.find((conversation) => conversation.id === nextId) ?? null);
      setRemoval(null);
    } catch (reason) {
      setRemoval(null);
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  return <div className="aur-finance-layout" style={layoutStyle}>
    <FinanceConversationList conversations={conversations} activeId={selectedId} pending={finance.pending} onCreate={() => { void create(); }} onSelect={select} onRemove={setRemoval} />
    <main className="aur-finance-main" style={mainStyle}>
      {error && <div role="alert" className="aur-inline-error">{error} <button type="button" className="aur-text-action" onClick={() => { setError(null); void refresh().catch((reason) => setError(reason instanceof Error ? reason.message : String(reason))); }}>retry</button></div>}
      {finance.error && <div role="alert" className="aur-inline-error">{finance.error}</div>}
      <header style={headerStyle}><div><div style={eyebrowStyle}>finance desk</div><h1 style={titleStyle}>{selected?.title ?? 'Transparent finance research'}</h1></div>{selected && <span style={statusStyle}>{selected.status}</span>}</header>
      <ChatTimeline
        activities={finance.activities}
        contentStyle={{ maxWidth: 860, padding: '12px 28px 20px' }}
        empty={<EmptyDesk onCreate={() => { void create(); }} />}
        messages={finance.messages}
        onRetry={() => selected ? finance.retry(selected) : false}
        pending={finance.pending}
        sessionId={selected?.id ?? null}
      />
      <FinanceComposer disabled={!selected} pending={finance.pending} statusMessage={finance.statusMessage} onSubmit={(question) => selected ? finance.submit(selected, question) : false} onCancel={finance.cancel} />
    </main>
    <FinanceAuditPanel conversation={selected} {...(finance.audit ? { audit: finance.audit } : {})} />
    {removal && <ConfirmDialog title="Delete finance research?" description={`The “${removal.title}” conversation and its local audit record will be deleted. This action cannot be undone.`} confirmLabel="Delete research" tone="danger" onCancel={() => setRemoval(null)} onConfirm={() => { void remove(); }} />}
  </div>;
}

function EmptyDesk({ onCreate }: { onCreate: () => void }) {
  return <section style={emptyStyle}><div style={eyebrowStyle}>research ready</div><h2 style={emptyTitleStyle}>Start a conversation in Finance Desk.</h2><p style={emptyTextStyle}>Ask about bonds, TLREF, yields, coupons, or scenario analysis. Data is shown with its sources and calculations with calculator results.</p><button type="button" onClick={onCreate} style={startButtonStyle}>new finance research</button></section>;
}

const layoutStyle: React.CSSProperties = { flex: 1, display: 'flex', minHeight: 0, background: 'var(--bg)' };
const mainStyle: React.CSSProperties = { flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' };
const headerStyle: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '24px 28px 8px' };
const eyebrowStyle: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--accent)' };
const titleStyle: React.CSSProperties = { margin: '6px 0 0', fontFamily: 'var(--font-serif)', fontSize: 25, lineHeight: 1.15, color: 'var(--text)' };
const statusStyle: React.CSSProperties = { padding: '4px 7px', borderRadius: 5, color: 'var(--text-muted)', background: 'var(--bg-alt)', fontFamily: 'var(--font-mono)', fontSize: 10.5 };
const emptyStyle: React.CSSProperties = { maxWidth: 650, margin: '34px auto 0', textAlign: 'center' };
const emptyTitleStyle: React.CSSProperties = { margin: '8px 0 0', fontFamily: 'var(--font-serif)', fontSize: 27, color: 'var(--text)' };
const emptyTextStyle: React.CSSProperties = { margin: '12px auto 0', fontFamily: 'var(--font-serif)', fontSize: 16, lineHeight: 1.55, color: 'var(--text-muted)' };
const startButtonStyle: React.CSSProperties = { marginTop: 17, padding: '10px 13px', color: 'var(--accent-ink)', background: 'var(--accent)', border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 600 };
