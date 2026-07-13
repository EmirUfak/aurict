import React, { useState } from 'react';
import type { AssistantBlock, DisplayMessage } from '../types.js';

interface Props {
  messages: DisplayMessage[];
  onRetry: () => boolean;
}

export function ChatTranscript({ messages, onRetry }: Props) {
  return <>{messages.map((message) => <ChatBubble key={message.id} message={message} {...(message.role === 'error' ? { onRetry } : {})} />)}</>;
}

function ChatBubble({ message, onRetry }: { message: DisplayMessage; onRetry?: () => boolean }) {
  if (message.role === 'user') return <div style={{ alignSelf: 'flex-end', maxWidth: '78%' }}><div style={userStyle}>{message.content}</div></div>;
  if (message.role === 'error') return <div style={{ maxWidth: '92%' }}><div style={errorStyle}><span>{message.content}</span>{onRetry && <button className="aur-text-action" onClick={onRetry} style={{ marginTop: 0 }}>retry last task</button>}</div></div>;
  return <div style={{ maxWidth: '88%' }}><div style={assistantHeadingStyle}><span style={brandStyle}>aurict</span>{message.pending && <span className="aur-pulse" style={pulseStyle} />}<CopyMessageButton message={message} /></div>{(message.blocks ?? []).map((block, index) => <AssistantBlockView key={index} block={block} />)}</div>;
}

function CopyMessageButton({ message }: { message: DisplayMessage }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const text = (message.blocks ?? []).map((block) => block.type === 'text' ? block.content : `${block.tool}: ${block.result ?? block.argsSummary}`).join('\n\n').trim();
    if (!text) return;
    void navigator.clipboard.writeText(text).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1_800); }).catch((error: unknown) => console.error('Failed to copy assistant message', error));
  };
  return <button type="button" onClick={copy} style={copyStyle}>{copied ? 'copied' : 'copy'}</button>;
}

function AssistantBlockView({ block }: { block: AssistantBlock }) {
  if (block.type === 'text') return <div style={textStyle}>{block.content}</div>;
  return <div style={toolCardStyle}><div style={toolHeaderStyle}><div style={toolLabelStyle}>{block.tool} · {block.argsSummary}</div><div style={{ ...toolStatusStyle, color: block.pending ? 'var(--accent)' : 'var(--text-subtle)' }}>{block.pending ? 'running…' : block.durationMs !== undefined ? `${block.durationMs}ms` : 'done'}</div></div>{block.result && <div style={toolResultStyle}>{block.result}</div>}</div>;
}

const userStyle: React.CSSProperties = { background: 'var(--bg-card)', borderRadius: '10px 10px 2px 10px', padding: '12px 16px', fontFamily: 'var(--font-serif)', fontSize: 15.5, lineHeight: 1.55, color: 'var(--text)' };
const errorStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--danger)' };
const assistantHeadingStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 };
const brandStyle: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--accent)' };
const pulseStyle: React.CSSProperties = { width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)' };
const copyStyle: React.CSSProperties = { minHeight: 20, marginLeft: 'auto', padding: '0 3px', color: 'var(--text-subtle)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10.5 };
const textStyle: React.CSSProperties = { fontFamily: 'var(--font-serif)', fontSize: 15.5, lineHeight: 1.62, color: 'var(--text-muted)', marginBottom: 10, whiteSpace: 'pre-wrap' };
const toolCardStyle: React.CSSProperties = { background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden', marginBottom: 10 };
const toolHeaderStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '9px 14px' };
const toolLabelStyle: React.CSSProperties = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-muted)' };
const toolStatusStyle: React.CSSProperties = { flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 10.5 };
const toolResultStyle: React.CSSProperties = { padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: 1.7, color: 'var(--text-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 220, overflowY: 'auto', borderTop: '1px solid var(--border-subtle)' };
