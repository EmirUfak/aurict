import React, { useEffect, useState } from 'react';
import type { ArtifactInfo } from '../../shared/ipc-types.js';
import { PdfPreview } from './PdfPreview.js';

interface Props { artifacts: ArtifactInfo[]; activeId: string | null; open: boolean; onClose: () => void; onSelect: (id: string) => void; }
export function ArtifactRail({ artifacts, activeId, open, onClose, onSelect }: Props) {
  const artifact = artifacts.find((item) => item.id === activeId) ?? null; const [url, setUrl] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  useEffect(() => { setUrl(null); setError(null); if (!artifact || artifact.lifecycle !== 'ready') return; void window.aurict.artifact.previewUrl(artifact.id).then(setUrl).catch((reason) => setError(reason instanceof Error ? reason.message : 'Preview unavailable.')); }, [artifact]);
  if (!open) return null;
  return <aside className="aur-artifact-rail" aria-label="Artifact preview"><header><strong>Artifacts</strong><button type="button" aria-label="Close artifact preview" onClick={onClose}>×</button></header><nav>{artifacts.map((item) => <button key={item.id} className={item.id === activeId ? 'active' : ''} onClick={() => onSelect(item.id)}><span>{icon(item.kind)}</span>{item.title}</button>)}</nav><main>{artifact ? <><div className="aur-artifact-meta"><span>{artifact.kind}</span><span>{artifact.lifecycle}</span><span>{new Date(artifact.updatedAt).toLocaleString()}</span></div>{error && <div className="aur-preview-error">{error}</div>}{artifact.lifecycle !== 'ready' ? <div className="aur-preview-empty">{artifact.error ?? `This artifact is ${artifact.lifecycle}.`}</div> : artifact.kind === 'pdf' && url ? <PdfPreview url={url} /> : artifact.kind === 'html' && url ? <iframe title={artifact.title} sandbox="allow-scripts" src={url} /> : artifact.kind === 'image' && url ? <img className="aur-artifact-image" src={url} alt={artifact.title} /> : url && ['markdown', 'code', 'table'].includes(artifact.kind) ? <TextPreview url={url} /> : <div className="aur-preview-empty">Preview for {artifact.kind} is download-only.</div>}</> : <div className="aur-preview-empty">Select an artifact to preview it.</div>}</main></aside>;
}
function icon(kind: ArtifactInfo['kind']) { return kind === 'pdf' ? 'PDF' : kind === 'html' ? 'WEB' : 'FILE'; }
function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState('loading…');
  useEffect(() => {
    let cancelled = false;
    void fetch(url).then(async (response) => {
      if (!response.ok) throw new Error(`Preview request failed (${response.status})`);
      return response.text();
    }).then((nextText) => {
      if (!cancelled) setText(nextText);
    }).catch((reason) => {
      console.error('Failed to load text artifact preview', reason);
      if (!cancelled) setText(`Preview unavailable: ${reason instanceof Error ? reason.message : String(reason)}`);
    });
    return () => { cancelled = true; };
  }, [url]);
  return <pre className="aur-text-preview">{text}</pre>;
}
