import React from 'react';
import { parseMarkdown, type MarkdownBlock } from './markdown-parser.js';

interface Props {
  content: string;
}

interface AuditRecord {
  summary?: string;
  dataAsOf?: string;
  methodology?: string;
  assumptions?: unknown;
  uncertainties?: unknown;
  sources?: unknown;
}

function inline(content: string): React.ReactNode[] {
  const parts = content.split(/(\*\*.+?\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index} style={{ color: 'var(--text)', fontWeight: 650 }}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index} style={inlineCodeStyle}>{part.slice(1, -1)}</code>;
    return part;
  });
}

function InlineText({ content }: { content: string }) {
  return <>{content.split('\n').map((line, index) => <React.Fragment key={index}>{index > 0 && <br />}{inline(line)}</React.Fragment>)}</>;
}

function AuditBlock({ content }: { content: string }) {
  let audit: AuditRecord | null = null;
  try {
    const candidate = JSON.parse(content);
    if (typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate)) audit = candidate as AuditRecord;
  } catch (error) {
    console.warn('Unable to render finance audit record', error);
  }
  if (!audit) return <pre style={codeStyle}>{content}</pre>;
  const assumptions = Array.isArray(audit.assumptions) ? audit.assumptions.filter((item): item is string => typeof item === 'string') : [];
  const uncertainties = Array.isArray(audit.uncertainties) ? audit.uncertainties.filter((item): item is string => typeof item === 'string') : [];
  const sources = Array.isArray(audit.sources) ? audit.sources.flatMap((source) => {
    if (typeof source !== 'object' || source === null || Array.isArray(source)) return [];
    const value = source as Record<string, unknown>;
    if (typeof value.title !== 'string' || typeof value.url !== 'string') return [];
    try {
      const url = new URL(value.url);
      return url.protocol === 'https:' || url.protocol === 'http:' ? [{ title: value.title, url: value.url }] : [];
    } catch (error) {
      console.warn('Ignoring invalid finance audit source URL', error);
      return [];
    }
  }) : [];
  return <details style={auditStyle}><summary style={auditSummaryStyle}>research audit{audit.dataAsOf ? ` · data as of ${audit.dataAsOf}` : ''}</summary><div style={auditBodyStyle}>
    {audit.summary && <div>{audit.summary}</div>}
    {audit.methodology && <div><div style={auditLabelStyle}>Methodology</div><div>{audit.methodology}</div></div>}
    {sources.length > 0 && <div><div style={auditLabelStyle}>Sources</div><div style={{ display: 'grid', gap: 4 }}>{sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" style={sourceStyle}>{source.title}</a>)}</div></div>}
    {assumptions.length > 0 && <AuditList label="Assumptions" items={assumptions} />}
    {uncertainties.length > 0 && <AuditList label="Uncertainties" items={uncertainties} />}
  </div></details>;
}

function AuditList({ label, items }: { label: string; items: string[] }) {
  return <div><div style={auditLabelStyle}>{label}</div><ul style={{ margin: '5px 0 0', paddingLeft: 18 }}>{items.map((item) => <li key={item}>{item}</li>)}</ul></div>;
}

function BlockView({ block }: { block: MarkdownBlock }) {
  switch (block.kind) {
    case 'heading': {
      const size = block.level === 1 ? 21 : block.level === 2 ? 17 : 14;
      return <div style={{ margin: block.level === 1 ? '18px 0 10px' : '16px 0 7px', fontFamily: 'var(--font-serif)', fontSize: size, lineHeight: 1.25, color: 'var(--text)', fontWeight: block.level <= 2 ? 650 : 600 }}><InlineText content={block.content} /></div>;
    }
    case 'paragraph': return <p style={paragraphStyle}><InlineText content={block.content} /></p>;
    case 'rule': return <hr style={ruleStyle} />;
    case 'list': {
      const List = block.ordered ? 'ol' : 'ul';
      return <List style={listStyle}>{block.items.map((item) => <li key={item}><InlineText content={item} /></li>)}</List>;
    }
    case 'table': return <div style={tableScrollStyle}><table style={tableStyle}><thead><tr>{block.headers.map((header) => <th key={header} style={headerCellStyle}><InlineText content={header} /></th>)}</tr></thead><tbody>{block.rows.map((row, rowIndex) => <tr key={`${rowIndex}-${row.join('|')}`}>{row.map((cell, cellIndex) => <td key={`${cellIndex}-${cell}`} style={cellStyle}><InlineText content={cell} /></td>)}</tr>)}</tbody></table></div>;
    case 'code': return block.language.toLowerCase() === 'finance-audit' ? <AuditBlock content={block.content} /> : <pre style={codeStyle}>{block.content}</pre>;
  }
}

export function MarkdownMessage({ content }: Props) {
  return <div style={messageStyle}>{parseMarkdown(content).map((block, index) => <BlockView key={`${block.kind}-${index}`} block={block} />)}</div>;
}

const messageStyle: React.CSSProperties = { marginBottom: 10, color: 'var(--text-muted)' };
const paragraphStyle: React.CSSProperties = { margin: '0 0 11px', fontFamily: 'var(--font-serif)', fontSize: 15.5, lineHeight: 1.62, color: 'var(--text-muted)' };
const inlineCodeStyle: React.CSSProperties = { padding: '1px 4px', borderRadius: 4, color: 'var(--accent)', background: 'var(--bg-deep)', fontFamily: 'var(--font-mono)', fontSize: '.88em' };
const ruleStyle: React.CSSProperties = { margin: '18px 0', border: 'none', borderTop: '1px solid var(--border-subtle)' };
const listStyle: React.CSSProperties = { margin: '0 0 13px', paddingLeft: 21, fontFamily: 'var(--font-serif)', fontSize: 15, lineHeight: 1.6, color: 'var(--text-muted)' };
const tableScrollStyle: React.CSSProperties = { margin: '12px 0 16px', overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 8 };
const tableStyle: React.CSSProperties = { width: '100%', minWidth: 460, borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.5 };
const headerCellStyle: React.CSSProperties = { padding: '8px 10px', textAlign: 'left', color: 'var(--text)', background: 'var(--bg-alt)', borderBottom: '1px solid var(--border-strong)', verticalAlign: 'top' };
const cellStyle: React.CSSProperties = { padding: '8px 10px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'top' };
const codeStyle: React.CSSProperties = { margin: '0 0 12px', padding: 11, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text-muted)', background: 'var(--bg-deep)', borderRadius: 7, fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.55 };
const auditStyle: React.CSSProperties = { margin: '14px 0', padding: 11, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 7 };
const auditSummaryStyle: React.CSSProperties = { cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--accent)' };
const auditBodyStyle: React.CSSProperties = { display: 'grid', gap: 10, marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.55, color: 'var(--text-muted)' };
const auditLabelStyle: React.CSSProperties = { marginBottom: 3, color: 'var(--text-subtle)', fontSize: 10, letterSpacing: '.05em', textTransform: 'uppercase' };
const sourceStyle: React.CSSProperties = { color: 'var(--accent)', textDecoration: 'none', overflowWrap: 'anywhere' };
