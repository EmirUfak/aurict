import React, { useEffect, useRef, useState } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import type { LanguageSupport } from '@codemirror/language';
import { basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { yaml } from '@codemirror/lang-yaml';
import { sql } from '@codemirror/lang-sql';
import { xml } from '@codemirror/lang-xml';
import { rust } from '@codemirror/lang-rust';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { php } from '@codemirror/lang-php';

// Deliberately NOT using @codemirror/language-data's auto-detect catalog —
// its entries dynamically import ~40 optional companion packages (lang-vue,
// lang-angular, lang-go, ...) that we don't install. Merely importing that
// catalog module (even without calling .load() on the unwanted entries) is
// enough to make Vite's dev server fail: it must resolve every import
// specifier syntactically present in a served module, static or dynamic.
// This small manual map only ever references packages we actually installed
// (see apps/desktop/package.json), so Vite never encounters an unresolvable
// specifier. Files with an extension not listed here just render as plain
// text — no syntax highlighting, but never a crash.
function languageExtensionFor(filename: string): LanguageSupport | null {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'js': case 'mjs': case 'cjs': return javascript();
    case 'jsx': return javascript({ jsx: true });
    case 'ts': case 'mts': case 'cts': return javascript({ typescript: true });
    case 'tsx': return javascript({ jsx: true, typescript: true });
    case 'json': return json();
    case 'css': return css();
    case 'html': case 'htm': return html();
    case 'md': case 'markdown': return markdown();
    case 'py': return python();
    case 'yml': case 'yaml': return yaml();
    case 'sql': return sql();
    case 'xml': return xml();
    case 'rs': return rust();
    case 'c': case 'h': case 'cpp': case 'cc': case 'hpp': case 'hh': return cpp();
    case 'java': return java();
    case 'php': return php();
    default: return null;
  }
}

const aurictTheme = EditorView.theme({
  '&': { backgroundColor: 'var(--bg-deep)', color: 'var(--text)', height: '100%', fontSize: '13px' },
  '.cm-content': { fontFamily: 'var(--font-mono)', caretColor: 'var(--accent)' },
  '.cm-scroller': { overflow: 'auto' },
  '.cm-gutters': { backgroundColor: 'var(--bg-deep)', color: 'var(--text-subtle)', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'var(--control-bg)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--control-bg)' },
  '.cm-cursor': { borderLeftColor: 'var(--accent)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'color-mix(in oklch, var(--accent) 28%, transparent)',
  },
}, { dark: true });

interface Props {
  path: string;
  onDirtyChange?: (path: string, dirty: boolean) => void;
}

export function CodeEditorTab({ path, onDirtyChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);

  const save = () => {
    const view = viewRef.current;
    if (!view) return;
    window.aurict.files.write(path, view.state.doc.toString()).then(() => {
      setDirty(false);
      onDirtyChange?.(path, false);
    }).catch((err) => setError(err instanceof Error ? err.message : String(err)));
  };
  // The keydown handler below is wired once per `path` (inside the effect) but
  // must always invoke the latest save closure, not the one captured at that
  // time — route through a ref so it never goes stale across re-renders.
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDirty(false);

    window.aurict.files.read(path).then((content) => {
      if (cancelled) return;
      const filename = path.split('/').pop() ?? path;
      const language = languageExtensionFor(filename);

      const extensions = [
        basicSetup,
        aurictTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            setDirty(true);
            onDirtyChange?.(path, true);
          }
        }),
        EditorView.domEventHandlers({
          keydown: (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 's') {
              event.preventDefault();
              saveRef.current();
              return true;
            }
            return false;
          },
        }),
        ...(language ? [language] : []),
      ];

      viewRef.current?.destroy();
      const container = containerRef.current;
      if (!container) throw new Error('Code editor container is unavailable');
      viewRef.current = new EditorView({
        state: EditorState.create({ doc: content, extensions }),
        parent: container,
      });
      setLoading(false);
    }).catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : String(err));
    });

    return () => {
      cancelled = true;
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [path]);

  if (error) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--danger)' }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: dirty ? 'var(--accent)' : 'var(--text-disabled)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>{path}</span>
        </div>
        <button
          onClick={save}
          disabled={!dirty}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, padding: '5px 12px', background: dirty ? 'var(--accent)' : 'var(--control-hover)', color: dirty ? 'var(--accent-ink)' : 'var(--text-subtle)', border: 'none', borderRadius: 6, cursor: dirty ? 'pointer' : 'default' }}
        >
          save (Ctrl+S)
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-muted)', background: 'var(--bg-deep)' }}>
            loading…
          </div>
        )}
        <div ref={containerRef} style={{ height: '100%' }} />
      </div>
    </div>
  );
}
