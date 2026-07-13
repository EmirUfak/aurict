import React, { useEffect, useState } from 'react';
import type { ArtifactInfo } from '../../shared/ipc-types.js';
import { PdfPreview } from './PdfPreview.js';

interface Props { artifacts: ArtifactInfo[]; activeId: string | null; open: boolean; onClose: () => void; onSelect: (id: string) => void; onRetry: (artifact: ArtifactInfo) => void; }

export function ArtifactRail({ artifacts, activeId, open, onClose, onSelect, onRetry }: Props) {
  const artifact = artifacts.find((item) => item.id === activeId) ?? null;
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [compareUrl, setCompareUrl] = useState<string | null>(null);
  const versions = artifact ? artifacts.filter((item) => item.id === artifact.id || item.title === artifact.title && item.kind === artifact.kind && item.sessionId === artifact.sessionId).sort((a, b) => a.createdAt - b.createdAt) : [];
  const comparison = versions.find((item) => item.id === compareId) ?? null;
  useEffect(() => {
    setUrl(null); setError(null); setNotice(null);
    if (!artifact || artifact.lifecycle !== 'ready') return;
    void window.aurict.artifact.previewUrl(artifact.id).then(setUrl).catch((reason) => setError(message(reason)));
  }, [artifact]);
  useEffect(() => { setCompareUrl(null); if (!comparison || comparison.lifecycle !== 'ready') return; void window.aurict.artifact.previewUrl(comparison.id).then(setCompareUrl).catch((reason) => setError(message(reason))); }, [comparison]);
  if (!open) return null;
  const copyText = async () => {
    if (!artifact) return;
    try { await navigator.clipboard.writeText(await window.aurict.artifact.readText(artifact.id)); setNotice('Text copied.'); }
    catch (reason) { setError(message(reason)); }
  };
  return <aside className="aur-artifact-rail" aria-label="Artifact preview">
    <header><div><strong>Artifacts</strong><small>{artifacts.length} created this session</small></div><button type="button" aria-label="Close artifact preview" onClick={onClose}>×</button></header>
    <nav>{artifacts.map((item) => <button key={item.id} className={item.id === activeId ? 'active' : ''} onClick={() => onSelect(item.id)}><span>{icon(item.kind)}</span><div><b>{item.title}</b><small>{item.lifecycle} · {new Date(item.updatedAt).toLocaleTimeString()}</small></div></button>)}</nav>
    <main>{artifact ? <>
      <div className="aur-artifact-meta"><span>{artifact.kind}</span><span>{artifact.lifecycle}</span><span>{new Date(artifact.updatedAt).toLocaleString()}</span></div>
      {versions.length > 1 && <div className="aur-artifact-actions" aria-label="Artifact version history"><span style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>versions</span>{versions.map((version, index) => <button key={version.id} type="button" aria-current={version.id === artifact.id ? 'true' : undefined} onClick={() => onSelect(version.id)}>v{index + 1}</button>)}<button type="button" onClick={() => setCompareId(compareId ? null : versions.find((item) => item.id !== artifact.id)?.id ?? null)}>{compareId ? 'Close compare' : 'Compare'}</button></div>}
      {artifact.lifecycle === 'ready' && <div className="aur-artifact-actions"><button type="button" onClick={() => void window.aurict.artifact.reveal(artifact.id).catch((reason) => setError(message(reason)))}>Show in folder</button><button type="button" onClick={() => void window.aurict.artifact.export(artifact.id).then((saved) => setNotice(saved ? 'Artifact exported.' : 'Export cancelled.')).catch((reason) => setError(message(reason)))}>Export…</button>{isText(artifact) && <button type="button" onClick={() => void copyText()}>Copy text</button>}</div>}
      {notice && <div className="aur-preview-notice">{notice}</div>}{error && <div className="aur-preview-error">{error}</div>}
      {artifact.lifecycle !== 'ready' ? <div className="aur-preview-empty">{artifact.error ?? `This artifact is ${artifact.lifecycle}.`}{artifact.lifecycle === 'failed' && artifact.prompt && <button type="button" className="aur-button aur-button-primary" style={{ marginTop: 14 }} onClick={() => onRetry(artifact)}>Retry generation</button>}{artifact.lifecycle === 'failed' && !artifact.prompt && <p>This result cannot be retried because its original request was not retained.</p>}</div> : compareId && comparison && url && compareUrl ? <div className="aur-artifact-compare"><section><small>Current</small><ArtifactPreview artifact={artifact} url={url} /></section><section><small>{comparison.title}</small><ArtifactPreview artifact={comparison} url={compareUrl} /></section></div> : url ? <ArtifactPreview artifact={artifact} url={url} /> : <div className="aur-preview-empty">Preview for {artifact.kind} is not available.</div>}
    </> : <div className="aur-preview-empty">Select an artifact to preview it.</div>}</main>
  </aside>;
}
function isText(artifact: ArtifactInfo) { return ['markdown', 'code', 'table', 'document'].includes(artifact.kind); }
function icon(kind: ArtifactInfo['kind']) { return kind === 'pdf' ? 'PDF' : kind === 'html' ? 'WEB' : 'FILE'; }
function message(reason: unknown) { return reason instanceof Error ? reason.message : 'Artifact action failed.'; }
function ArtifactPreview({ artifact, url }: { artifact: ArtifactInfo; url: string }) { return artifact.kind === 'pdf' ? <PdfPreview url={url} /> : artifact.kind === 'html' ? <iframe title={artifact.title} sandbox="allow-scripts" src={url} /> : artifact.kind === 'image' ? <img className="aur-artifact-image" src={url} alt={artifact.title} /> : isText(artifact) ? <TextPreview url={url} /> : <div className="aur-preview-empty">Preview for {artifact.kind} is not available.</div>; }
function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState('Loading preview…');
  useEffect(() => { let cancelled = false; void fetch(url).then((response) => response.ok ? response.text() : Promise.reject(new Error(`Preview request failed (${response.status})`))).then((nextText) => { if (!cancelled) setText(nextText); }).catch((reason) => { if (!cancelled) setText(`Preview unavailable: ${message(reason)}`); }); return () => { cancelled = true; }; }, [url]);
  return <pre className="aur-text-preview">{text}</pre>;
}
