import React, { useEffect, useRef, useState } from 'react';
import type { useChat } from '../hooks/useChat.js';
import { useDesign } from '../hooks/useDesign.js';
import type { ChatAttachment, UserType } from '../../shared/ipc-types.js';
import { ModelSelector } from '../components/ModelSelector.js';
import { useToasts, ToastRegion } from '../components/ToastRegion.js';
import { useErrorToast } from '../hooks/useErrorToast.js';

const sectionHeading: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase',
  color: 'var(--text-subtle)', marginBottom: 12,
};

const selectStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)',
  background: 'var(--bg-deep)', border: '1px solid var(--border-strong)', borderRadius: 6,
  padding: '7px 10px', flex: 1, minWidth: 0,
};

const THUMB_PAGE_WIDTH = 1280;
const THUMB_PAGE_HEIGHT = 800;
const THUMB_CARD_WIDTH = 268;
const THUMB_CARD_HEIGHT = 168;
const THUMB_SCALE = THUMB_CARD_WIDTH / THUMB_PAGE_WIDTH;

const PREVIEW_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  'img-src data: blob:',
  'media-src data: blob:',
  "connect-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

function securePreviewHtml(html: string): string {
  const policy = `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">`;
  if (/<head(?:\s[^>]*)?>/i.test(html)) return html.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${policy}`);
  return `<!doctype html><html><head>${policy}</head><body>${html}</body></html>`;
}

interface DesignScreenProps {
  chat: ReturnType<typeof useChat>;
  onLaunched: () => void;
  userType: UserType;
}

export function DesignScreen({ chat, onLaunched, userType }: DesignScreenProps) {
  const design = useDesign();
  const { toasts, show: showToast, dismiss: dismissToast } = useToasts();
  useErrorToast(design.error, design.errorSeq, design.refreshOutputs, showToast);
  const [brief, setBrief] = useState('');
  const [systemId, setSystemId] = useState('');
  const [skillId, setSkillId] = useState('');
  const [matched, setMatched] = useState(false);
  const [matching, setMatching] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [iteration, setIteration] = useState('');
  const [references, setReferences] = useState<ChatAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewArtifact = previewSlug ? design.artifacts.find((artifact) => artifact.id === previewSlug) : undefined;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = brief.trim();
    if (trimmed.length < 6) { setMatched(false); setMatching(false); return; }
    setMatched(false);
    setMatching(true);
    debounceRef.current = setTimeout(() => {
      window.aurict.design.match(trimmed).then((m) => {
        setSystemId(m.systemId);
        setSkillId(m.skillId);
        setMatched(true);
        setMatching(false);
      }).catch((matchError) => {
        console.error('Failed to match design workflow', matchError);
        setMatched(false);
        setMatching(false);
        setError(matchError instanceof Error ? matchError.message : 'Aurict could not select a design workflow.');
      });
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [brief]);

  const handleGenerate = () => {
    const trimmed = brief.trim();
    if (!trimmed || !systemId || !skillId || launching) return;
    setError(null);
    setLaunching(true);
    design.createArtifact({ brief: trimmed, systemId, skillId }).then(({ prompt, artifact }) => {
      chat.submit(prompt, undefined, artifact.id, `Create design: ${trimmed}`, 'create', references);
      setReferences([]);
      onLaunched();
    }).catch((createError) => {
      console.error('Failed to create design artifact', createError);
      setError(createError instanceof Error ? createError.message : 'Design generation could not be started.');
    }).finally(() => setLaunching(false));
  };

  const openPreview = (slug: string) => {
    setPreviewSlug(slug);
    setPreviewHtml(null);
    setError(null);
    window.aurict.design.readOutput(slug).then(setPreviewHtml).catch((error) => {
      console.error(`Failed to load design ${slug}`, error);
      setError('The selected design preview could not be loaded. You can retry from the artifact card.');
      setPreviewHtml('<p>Preview unavailable.</p>');
    });
  };

  useEffect(() => {
    if (!previewSlug || chat.pending) return;
    window.aurict.design.readOutput(previewSlug).then(setPreviewHtml).catch((error) => console.error(`Failed to refresh design ${previewSlug}`, error));
    design.refreshOutputs();
  }, [chat.pending, design.refreshOutputs, previewSlug]);

  useEffect(() => {
    if (!previewSlug) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewSlug(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewSlug]);

  const handleIteration = () => {
    const request = iteration.trim();
    if (!request || !previewSlug || chat.pending) return;
    setError(null);
    chat.submit(request, undefined, previewSlug);
    setIteration('');
  };

  const handlePromote = () => {
    if (!previewSlug || chat.pending) return;
    setError(null);
    chat.submit(
      'Implement this approved design in the active workspace. Inspect the existing application first, propose the smallest implementation plan, then make the changes only after the normal approval flow allows them.',
      undefined,
      previewSlug,
      `Promote design ${previewSlug} to the application`,
      'promote',
    );
    onLaunched();
  };

  const handleRetry = () => {
    if (!previewArtifact || previewArtifact.status !== 'failed' || chat.pending || launching) return;
    setLaunching(true);
    design.retryArtifact(previewArtifact.id).then(({ prompt, artifact }) => {
      chat.submit(prompt, undefined, artifact.id, `Retry design: ${artifact.title}`, 'create');
      onLaunched();
    }).catch((error) => {
      console.error(`Failed to retry design ${previewArtifact.id}`, error);
      setError(error instanceof Error ? error.message : 'Design retry could not be started.');
    }).finally(() => setLaunching(false));
  };

  const addReferences = async () => {
    try {
      const selected = await window.aurict.files.pickImages();
      setReferences((current) => [...current, ...selected.filter((file) => !current.some((existing) => existing.path === file.path))]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Image references could not be selected.');
    }
  };

  return (
    <div className="aur-design-layout" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative', background: 'var(--bg)' }}>
      {/* Gallery — Figma-canvas style grid of live thumbnails */}
      <div className="aur-design-gallery" style={{ flex: 1, overflowY: 'auto', padding: '32px 32px 8px' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto' }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 28, color: 'var(--text)', margin: '0 0 6px' }}>
            Design
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 24px' }}>
            Describe what you want built below. Aurict matches a design skill + visual system, then builds it.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><div style={sectionHeading}>past designs</div><button type="button" className="aur-text-action" style={{ marginTop: 0 }} onClick={() => { void design.refreshOutputs().catch((reason) => setError(reason instanceof Error ? reason.message : String(reason))); }}>refresh</button></div>
          {design.loading ? (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-subtle)', padding: '24px 0' }}>Loading design artifacts…</div>
          ) : design.artifacts.length === 0 ? (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-subtle)', padding: '24px 0' }}>
              No designs generated yet — describe one below to get started.
            </div>
          ) : (
            <div className="aur-design-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, ${THUMB_CARD_WIDTH}px)`, gap: 16, paddingBottom: 24 }}>
              {design.artifacts.map((artifact) => (
                <DesignCard key={artifact.id} artifact={artifact} onClick={() => openPreview(artifact.id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Composer — brief input, matching MainScreen's chat composer treatment */}
      <div className="aur-design-composer" style={{ padding: '14px 32px 20px', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto' }}>
          {matched && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <select value={skillId} onChange={(e) => setSkillId(e.target.value)} style={selectStyle}>
                {design.skills.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.mode})</option>
                ))}
              </select>
              <select value={systemId} onChange={(e) => setSystemId(e.target.value)} style={selectStyle}>
                {design.systems.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} — {s.category}</option>
                ))}
              </select>
            </div>
          )}
          {(error ?? design.error) && <div role="alert" className="aur-inline-error">{error ?? design.error}</div>}
          {references.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {references.map((reference) => (
                <span key={reference.path} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 7px', borderRadius: 5, background: 'var(--control-bg)', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-muted)' }}>
                  {reference.path.split('/').pop()}
                  <button aria-label={`Remove ${reference.path.split('/').pop() ?? 'image reference'}`} onClick={() => setReferences((current) => current.filter((item) => item.path !== reference.path))} style={{ minHeight: 18, padding: 0, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>×</button>
                </span>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 10, padding: '10px 10px 10px 16px' }}>
            <textarea
              value={brief}
              onChange={(e) => { setBrief(e.target.value); setError(null); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              placeholder={userType === 'designer' ? 'Describe the visual direction, audience, and key screens…' : 'e.g. "Linear-style project dashboard" · "Stripe-style pricing page" · "mobile onboarding flow"'}
              rows={1}
              style={{
                flex: 1, fontFamily: 'var(--font-serif)', fontSize: 15, color: 'var(--text)',
                padding: '6px 0', background: 'transparent', border: 'none',
                resize: 'none', maxHeight: 160,
              }}
            />
              <button
                onClick={() => { void addReferences(); }}
                title="Add image references"
                style={{ fontFamily: 'var(--font-mono)', fontSize: 16, padding: '6px 8px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                +
              </button>
              <button
                onClick={handleGenerate}
              disabled={!matched || launching}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 600, padding: '9px 16px',
                background: !matched || launching ? 'var(--control-hover)' : 'var(--accent)',
                color: !matched || launching ? 'var(--text-subtle)' : 'var(--accent-ink)',
                border: 'none', borderRadius: 7, cursor: !matched || launching ? 'default' : 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {launching ? 'launching…' : 'generate ↵'}
            </button>
          </div>
          {matching && <div aria-live="polite" role="status" style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-subtle)' }}>Matching a workflow and visual system…</div>}
          <ModelSelector />
        </div>
      </div>

      {previewSlug && (
        <div
          aria-modal="true"
          onClick={() => setPreviewSlug(null)}
          onKeyDown={(event) => { if (event.key === 'Escape') setPreviewSlug(null); }}
          role="presentation"
          style={{ position: 'absolute', inset: 0, background: 'oklch(0 0 0 / .6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
        >
          <div
            aria-label={`Design preview for ${previewSlug}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            style={{ width: '90%', height: '88%', background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 40px 90px -20px oklch(0 0 0 / .7)', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: 'var(--bg-deep)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-muted)' }}>{previewSlug}{previewArtifact ? ` · ${previewArtifact.status}` : ''}</span>
              <button type="button" aria-label="Close preview" onClick={() => setPreviewSlug(null)} style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>×</button>
            </div>
            {previewHtml === null ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: '#666' }}>
                loading…
              </div>
            ) : (
              // sandbox="allow-scripts" WITHOUT "allow-same-origin": the generated
              // page can run its own inline JS/CSS and hit the Google Fonts CDN, but
              // stays in a unique opaque origin — it can never reach window.aurict,
              // ipcRenderer, cookies, or the local filesystem. Combining allow-scripts
              // with allow-same-origin on srcDoc content is a documented sandbox
              // escape (the frame could strip its own sandbox attribute and reload
              // unrestricted), so allow-same-origin is deliberately omitted.
              <iframe
                title={previewSlug}
                sandbox="allow-scripts"
                srcDoc={securePreviewHtml(previewHtml)}
                style={{ flex: 1, border: 'none', width: '100%' }}
              />
            )}
            <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: 'var(--bg-deep)', borderTop: '1px solid var(--border-subtle)' }}>
              {previewArtifact?.status === 'failed' && <button onClick={handleRetry} disabled={chat.pending || launching} style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 600, padding: '8px 12px', color: 'var(--accent-ink)', background: 'var(--accent)', border: 'none', borderRadius: 6, cursor: chat.pending || launching ? 'default' : 'pointer' }}>{launching ? 'retrying…' : 'retry generation'}</button>}
              <input
                value={iteration}
                onChange={(e) => setIteration(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleIteration(); }}
                placeholder="Describe a change to this design…"
                disabled={chat.pending}
                style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-mono)', fontSize: 12, padding: '8px 10px', color: 'var(--text)', background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 6 }}
              />
              <button
                onClick={handleIteration}
                disabled={!iteration.trim() || chat.pending}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 600, padding: '8px 12px', color: chat.pending ? 'var(--text-subtle)' : 'var(--accent-ink)', background: chat.pending ? 'var(--control-hover)' : 'var(--accent)', border: 'none', borderRadius: 6, cursor: chat.pending ? 'default' : 'pointer' }}
              >
                {chat.pending ? 'updating…' : 'apply'}
              </button>
              <button
                onClick={handlePromote}
                disabled={chat.pending}
                title="Turn this prototype into workspace code"
                style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, padding: '8px 12px', color: 'var(--text)', background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: chat.pending ? 'default' : 'pointer' }}
              >
                promote
              </button>
            </div>
          </div>
        </div>
      )}
      <ToastRegion toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function DesignCard({ artifact, onClick }: { artifact: { id: string; title: string; status: string; revisions: Array<unknown>; updatedAt: number }; onClick: () => void }) {
  const [html, setHtml] = useState<string | null>(null);
  const { id: slug, status, revisions } = artifact;

  useEffect(() => {
    let cancelled = false;
    window.aurict.design.readOutput(slug).then((h) => { if (!cancelled) setHtml(h); }).catch((error) => console.error(`Failed to load design thumbnail ${slug}`, error));
    return () => { cancelled = true; };
  }, [slug]);

  return (
    <div
      aria-label={`Open ${slug}`}
      onClick={onClick}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick(); } }}
      role="button"
      tabIndex={0}
      style={{ width: THUMB_CARD_WIDTH, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-subtle)', cursor: 'pointer', background: 'var(--bg-card)' }}
    >
      <div style={{ width: THUMB_CARD_WIDTH, height: THUMB_CARD_HEIGHT, overflow: 'hidden', position: 'relative', background: '#fff' }}>
        {html === null ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#999' }}>
            loading…
          </div>
        ) : (
          // Same sandbox posture as the full preview modal (allow-scripts only,
          // no allow-same-origin) — rendered at full page size then scaled down
          // visually, the standard technique for HTML thumbnails without a
          // separate screenshot pipeline. pointerEvents:none since this is a
          // static thumbnail, not an interactive embed.
          <iframe
            title={slug}
            sandbox="allow-scripts"
              srcDoc={securePreviewHtml(html)}
            style={{
              width: THUMB_PAGE_WIDTH, height: THUMB_PAGE_HEIGHT, border: 'none',
              transform: `scale(${THUMB_SCALE})`, transformOrigin: 'top left', pointerEvents: 'none',
            }}
          />
        )}
      </div>
      <div style={{ padding: '8px 10px' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 13.5, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{artifact.title}</div>
        <div style={{ marginTop: 3, fontFamily: 'var(--font-mono)', fontSize: 10.5, color: status === 'failed' ? 'var(--danger)' : status === 'ready' ? 'var(--safe)' : 'var(--text-subtle)' }}>{status} · r{revisions.length} · {new Date(artifact.updatedAt).toLocaleDateString()}</div>
      </div>
    </div>
  );
}
