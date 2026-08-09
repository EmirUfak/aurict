import React, { useState } from 'react';
import { useSkills } from '../hooks/useSkills.js';

export function ExtensionsScreen() {
  const { skills, install, uninstall } = useSkills();
  const [urlDraft, setUrlDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInstall = () => {
    const url = urlDraft.trim();
    if (!url || pending) return;
    setPending(true);
    setError(null);
    install(url).then((result) => {
      setPending(false);
      if ('error' in result) setError(result.error);
      else setUrlDraft('');
      }).catch((reason: unknown) => {
      console.error('Failed to install skill', reason);
      setPending(false);
      setError(reason instanceof Error ? reason.message : 'Skill could not be installed.');
    });
  };

  const handleUninstall = (id: string) => {
    setError(null);
    uninstall(id).catch((reason: unknown) => {
      console.error('Failed to uninstall skill', reason);
      setError(reason instanceof Error ? reason.message : 'Skill could not be removed.');
    });
  };
  
  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 32px 64px' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 28, color: 'var(--text)', margin: '0 0 6px' }}>
          Extensions
        </h1>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 20px' }}>
          {skills.length}+ framework and tool-specific skills, activated automatically when your stack is detected.
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
          <input
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleInstall(); }}
            placeholder="SKILL.md URL or local path…"
            style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12.5, padding: '9px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 7, color: 'var(--text)' }}
          />
          <button
            onClick={handleInstall}
            disabled={pending || !urlDraft.trim()}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 600, padding: '9px 16px', background: pending || !urlDraft.trim() ? 'var(--control-hover)' : 'var(--accent)', color: pending || !urlDraft.trim() ? 'var(--text-subtle)' : 'var(--accent-ink)', border: 'none', borderRadius: 7, cursor: pending ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
          >
            {pending ? 'installing…' : '+ add skill'}
          </button>
        </div>
        {error && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--danger)', marginTop: -20, marginBottom: 20 }}>{error}</div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1, background: 'var(--control-bg)', borderRadius: 8, overflow: 'hidden' }}>
          {skills.map((s) => (
            <div key={s.id} style={{ padding: '16px 18px', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--text)' }}>{s.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.active ? 'var(--safe)' : 'var(--text-disabled)' }} />
                  {s.installed && (
                    <button type="button"
                      onClick={() => handleUninstall(s.id)}
                      style={{ padding: 0, fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--danger)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >
                      remove
                    </button>
                  )}
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{s.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
