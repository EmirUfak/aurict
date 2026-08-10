import React, { useCallback, useState } from 'react';
import type { useChat } from '../hooks/useChat.js';
import type { useSessions } from '../hooks/useSessions.js';
import { useFileTree } from '../hooks/useFileTree.js';
import { useProviders } from '../hooks/useProviders.js';
import { useModelSelection } from '../hooks/useModelSelection.js';
import { useAgents } from '../hooks/useAgents.js';
import { CodeEditorTab } from '../components/CodeEditorTab.js';
import { ConfirmDialog, PromptDialog } from '../components/Dialog.js';
import { ToastRegion, useToasts } from '../components/ToastRegion.js';
import type { usePermission } from '../hooks/usePermission.js';
import type { UserType } from '../../shared/ipc-types.js';
import { ChatTimeline } from '../components/ChatTimeline.js';
import { ContextDrawer } from '../components/TaskActivity.js';
import { CenterTab, PanelTab, SessionMetadata } from '../components/WorkspaceChrome.js';
import { VirtualSessionList } from '../components/VirtualSessionList.js';
import { useErrorToast } from '../hooks/useErrorToast.js';
import type { useWorkdir } from '../hooks/useWorkdir.js';

const selectStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)',
  background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 5,
  padding: '3px 6px', cursor: 'pointer',
};
const fileActionButtonStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 600, padding: '4px 8px',
  background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-strong)',
  borderRadius: 5, cursor: 'pointer',
};
const fileIconButtonStyle: React.CSSProperties = {
  minHeight: 22, padding: 0, fontFamily: 'var(--font-mono)', fontSize: 10.5,
  color: 'var(--text-subtle)', background: 'transparent', border: 'none', cursor: 'pointer',
};

const LEVEL_META = {
  safe: { color: 'var(--safe)', label: 'safe' },
  warning: { color: 'var(--warning)', label: 'warning' },
  danger: { color: 'var(--danger)', label: 'danger' },
} as const;

interface MainScreenProps {
  permission: ReturnType<typeof usePermission>;
  chat: ReturnType<typeof useChat>;
  sessions: ReturnType<typeof useSessions>;
  workdir: ReturnType<typeof useWorkdir>;
  providers: ReturnType<typeof useProviders>;
  agents: ReturnType<typeof useAgents>;
  modelSelection: ReturnType<typeof useModelSelection>;
  userType: UserType;
}

interface ConfirmAction {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
}

const PROFILE_COPY: Record<Exclude<UserType, 'designer'>, { empty: string; placeholder: string }> = {
  general: { empty: 'Ask Aurict to explore an idea, answer a question, or help with a task.', placeholder: 'What would you like help with?' },
  developer: { empty: 'Ask Aurict to fix, refactor, or explain something in this workspace.', placeholder: 'Fix, refactor, or explain code…' },
  product: { empty: 'Describe a product problem, flow, or feature to turn into a clear next step.', placeholder: 'Describe the product outcome you want…' },
  operator: { empty: 'Ask Aurict to analyze, organize, or automate work in this workspace.', placeholder: 'Describe the work you want to streamline…' },
  finance: { empty: 'Ask Aurict to research a topic, explain a formula, or prepare a transparent calculation.', placeholder: 'Research or calculate something…' },
};

export function MainScreen({ permission, chat, sessions, workdir, providers, agents, modelSelection, userType }: MainScreenProps) {
  const fileTree = useFileTree();
  const [rightTab, setRightTab] = useState<'files' | 'tasks'>('files');
  const [draft, setDraft] = useState('');
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [activeCenterTab, setActiveCenterTab] = useState<string>('chat');
  const [dirtyFiles, setDirtyFiles] = useState<Record<string, boolean>>({});
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [promptKind, setPromptKind] = useState<'file' | 'folder' | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const [contextOpen, setContextOpen] = useState(false);
  const [sessionRenameId, setSessionRenameId] = useState<string | null>(null);
  const [sessionTitleDraft, setSessionTitleDraft] = useState('');
  const [sessionQuery, setSessionQuery] = useState('');
  const { toasts, show: showToast, dismiss: dismissToast } = useToasts();
  useErrorToast(sessions.error, sessions.errorSeq, sessions.retryAction, showToast, dismissToast);
  useErrorToast(providers.error, providers.errorSeq, providers.refresh, showToast, dismissToast);
  useErrorToast(fileTree.error, fileTree.errorSeq, fileTree.refresh, showToast, dismissToast);
  useErrorToast(workdir.error, workdir.errorSeq, workdir.reload, showToast, dismissToast);
  useErrorToast(agents.error, agents.errorSeq, agents.refresh, showToast, dismissToast);
  useErrorToast(modelSelection.error, modelSelection.errorSeq, null, showToast, dismissToast);
  const profileCopy = PROFILE_COPY[userType === 'designer' ? 'developer' : userType];
  const activeSession = sessions.sessions.find((session) => session.id === sessions.activeId) ?? null;

  const handleSend = () => {
    if (!draft.trim() || chat.pending) return;
    chat.submit(draft, agents.agentId);
    setDraft('');
  };

  const openFileTab = (path: string) => {
    setOpenFiles((prev) => (prev.includes(path) ? prev : [...prev, path]));
    setActiveCenterTab(path);
  };
  const closeFileTabNow = (path: string) => {
    setOpenFiles((prev) => prev.filter((p) => p !== path));
    setDirtyFiles((prev) => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
    setActiveCenterTab((cur) => (cur === path ? 'chat' : cur));
  };
  const closeFileTab = (path: string) => {
    if (!dirtyFiles[path]) {
      closeFileTabNow(path);
      return;
    }
    setConfirmAction({
      title: 'Discard unsaved changes?',
      description: `${path} has changes that have not been saved. This cannot be undone.`,
      confirmLabel: 'Close without saving',
      onConfirm: () => closeFileTabNow(path),
    });
  };
  const handleFileDirtyChange = useCallback((path: string, dirty: boolean) => {
    setDirtyFiles((prev) => ({ ...prev, [path]: dirty }));
  }, []);

  const openCreatePrompt = (kind: 'file' | 'folder') => {
    setPromptValue('');
    setPromptKind(kind);
  };
  const submitCreatePrompt = () => {
    const name = promptValue.trim();
    const kind = promptKind;
    if (!name || !kind) return;
    setPromptKind(null);
    const create = kind === 'file' ? window.aurict.files.create(name) : window.aurict.files.mkdir(name);
    void create.then((res) => {
      if (!res.ok) {
        showToast(res.error ?? `Failed to create ${kind}`, 'error');
        return;
      }
      fileTree.refresh();
      if (kind === 'file') openFileTab(name);
      showToast(`${kind === 'file' ? 'File' : 'Folder'} created`, 'success');
    });
  };
  const handleDeleteFile = (path: string) => {
    setConfirmAction({
      title: 'Delete file?',
      description: `${path} will be permanently removed from this workspace.`,
      confirmLabel: 'Delete file',
      onConfirm: () => {
        void window.aurict.files.delete(path).then((res) => {
          if (!res.ok) {
            showToast(res.error ?? 'Failed to delete file', 'error');
            return;
          }
          fileTree.refresh();
          closeFileTabNow(path);
          showToast('File deleted', 'success');
        });
      },
    });
  };
  const startRename = (path: string) => {
    setRenamingPath(path);
    setRenameDraft(path);
  };
  const commitRename = () => {
    const oldPath = renamingPath;
    const newPath = renameDraft.trim();
    setRenamingPath(null);
    if (!oldPath || !newPath || newPath === oldPath) return;
    void window.aurict.files.rename(oldPath, newPath).then((res) => {
      if (!res.ok) { showToast(res.error ?? 'Failed to rename file', 'error'); return; }
      fileTree.refresh();
      setOpenFiles((prev) => prev.map((p) => (p === oldPath ? newPath : p)));
      setActiveCenterTab((cur) => (cur === oldPath ? newPath : cur));
      showToast('File renamed', 'success');
    });
  };
  const commitSessionRename = () => {
    const id = sessionRenameId; const title = sessionTitleDraft.trim();
    setSessionRenameId(null);
    if (!id || !title) return;
    void sessions.rename(id, title).then(() => showToast('Session renamed', 'success')).catch((error) => showToast(error instanceof Error ? error.message : 'Session could not be renamed', 'error'));
  };

  return (
    <div className="aur-developer-layout" style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
      {/* LEFT: session history */}
      <div style={{ width: 236, minWidth: 236, background: 'var(--bg-alt)', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '14px 14px 10px' }}>
          <button
            onClick={sessions.create}
            style={{
              width: '100%', fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 600,
              padding: '10px 12px', background: 'var(--accent)', color: 'var(--accent-ink)',
              border: 'none', borderRadius: 6, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            + new session
          </button>
        </div>
        <div style={{ padding: '4px 14px 8px', fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>
          sessions
        </div>
        <div style={{ padding: '0 14px 8px' }}><input aria-label="Search session history" value={sessionQuery} onChange={(event) => { const value = event.target.value; setSessionQuery(value); void sessions.search(value).catch((reason) => showToast(reason instanceof Error ? reason.message : 'Search failed', 'error')); }} placeholder="search history" style={{ width: '100%', minHeight: 30, padding: '5px 7px', color: 'var(--text)', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 5, fontFamily: 'var(--font-mono)', fontSize: 10.5 }} /></div>
        {sessionQuery.trim() && <div style={{ maxHeight: 132, overflowY: 'auto', padding: '0 14px 8px' }}>{sessions.searchResults.length === 0 ? <small style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)' }}>No matching messages.</small> : sessions.searchResults.map((result) => <button key={result.sessionId} type="button" onClick={() => { sessions.select(result.sessionId); setSessionQuery(''); }} style={{ width: '100%', padding: '6px 0', color: 'var(--text-muted)', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10.5, textAlign: 'left' }}><b style={{ display: 'block', color: 'var(--text)' }}>{result.title ?? 'untitled session'}</b><span>{result.matchCount} matches · {result.excerpt}</span></button>)}</div>}
        <VirtualSessionList sessions={sessions.sessions} activeId={sessions.activeId} onSelect={sessions.select} onRename={(session) => { setSessionRenameId(session.id); setSessionTitleDraft(session.title ?? ''); }} onBranch={(session) => { void sessions.branch(session.id).then(() => showToast('Branched session is ready', 'success')).catch((error) => showToast(error instanceof Error ? error.message : 'Session could not be branched', 'error')); }} onArchive={(session) => { void sessions.archive(session.id, session.status !== 'archived').then(() => showToast(session.status === 'archived' ? 'Session restored' : 'Session archived', 'success')).catch((error) => showToast(error instanceof Error ? error.message : 'Session could not be updated', 'error')); }} onRemove={(session) => setConfirmAction({ title: 'Delete session?', description: `Delete ${session.title ?? 'this session'} and its local conversation history?`, confirmLabel: 'Delete session', onConfirm: () => sessions.remove(session.id) })} />
        {activeSession && <SessionMetadata session={activeSession} />}
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: 8 }}>
            agent modes
          </div>
          {agents.agents.map((a) => {
            const active = a.id === agents.agentId;
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={active}
                onClick={() => agents.setAgentId(a.id)}
                title={a.description}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 24, margin: '0 6px 6px 0', padding: '2px 4px', color: 'var(--text)', background: active ? 'var(--control-hover)' : 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: active ? a.color : 'var(--text-disabled)' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: active ? 'var(--text)' : 'var(--text-muted)' }}>{a.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* CENTER: chat + open file tabs */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, background: 'var(--bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '10px 16px 0', borderBottom: '1px solid var(--border-subtle)', overflowX: 'auto' }}>
          <CenterTab label="chat" active={activeCenterTab === 'chat'} onClick={() => setActiveCenterTab('chat')} />
          {openFiles.map((path) => (
            <CenterTab
              key={path}
              label={path.split('/').pop() ?? path}
              active={activeCenterTab === path}
              dirty={Boolean(dirtyFiles[path])}
              onClick={() => setActiveCenterTab(path)}
              onClose={() => closeFileTab(path)}
            />
          ))}
        </div>

        {activeCenterTab !== 'chat' && openFiles.includes(activeCenterTab) ? (
          <CodeEditorTab path={activeCenterTab} onDirtyChange={handleFileDirtyChange} />
        ) : (
          <>
            <ChatTimeline
              activities={chat.activities}
              contentStyle={{ maxWidth: 760, padding: '24px 32px 8px' }}
              empty={<div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-subtle)', textAlign: 'center', marginTop: 40 }}>{profileCopy.empty}</div>}
              messages={chat.messages}
              onRetry={chat.retryLast}
              pending={chat.pending}
              sessionId={sessions.activeId}
            />

            {/* Composer */}
            <div style={{ padding: '14px 32px 20px', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 10, padding: '10px 10px 10px 16px' }}>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={profileCopy.placeholder}
                rows={1}
                style={{
                  flex: 1, fontFamily: 'var(--font-serif)', fontSize: 15, color: 'var(--text)',
                  padding: '6px 0', background: 'transparent', border: 'none',
                  resize: 'none', maxHeight: 160,
                }}
              />
              <button
                onClick={handleSend}
                disabled={chat.pending || !draft.trim()}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 600, padding: '9px 16px',
                  background: chat.pending || !draft.trim() ? 'var(--control-hover)' : 'var(--accent)',
                  color: chat.pending || !draft.trim() ? 'var(--text-subtle)' : 'var(--accent-ink)',
                  border: 'none', borderRadius: 7, cursor: chat.pending ? 'default' : 'pointer', whiteSpace: 'nowrap',
                }}
              >
                send ↵
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, paddingLeft: 4 }}>
              <select
                value={modelSelection.providerId ?? ''}
                onChange={(e) => modelSelection.selectProvider(e.target.value)}
                onFocus={() => { if (providers.error) void providers.refresh().catch(() => undefined); }}
                style={selectStyle}
              >
                {providers.providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select
                value={modelSelection.modelId ?? ''}
                onChange={(e) => modelSelection.selectModel(e.target.value)}
                style={selectStyle}
              >
                {modelSelection.models.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <select
                value={agents.agentId}
                onChange={(e) => agents.setAgentId(e.target.value)}
                style={selectStyle}
              >
                {agents.agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <button type="button" className="aur-context-button" onClick={() => setContextOpen(true)}>context</button>
              <div style={{ flex: 1 }} />
              {chat.pending && (
                <>
                  <span className="aur-pulse" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)' }} />
                  <span aria-live="polite" role="status" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-subtle)' }}>{chat.statusMessage ?? 'aurict is working…'}</span>
                  <button onClick={chat.cancel} style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--danger)', background: 'transparent', border: 'none', cursor: 'pointer' }}>stop</button>
                </>
              )}
            </div>
          </div>
        </div>
          </>
        )}
      </div>

      {/* RIGHT: files / tasks */}
      <div style={{ width: 268, minWidth: 268, background: 'var(--bg-alt)', borderLeft: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '12px 14px 0', display: 'flex', alignItems: 'center', gap: 2, borderBottom: '1px solid var(--border-subtle)' }}>
          <PanelTab label="files" active={rightTab === 'files'} onClick={() => setRightTab('files')} />
          <PanelTab label="tasks" active={rightTab === 'tasks'} onClick={() => setRightTab('tasks')} />
          <div style={{ flex: 1 }} />
          {rightTab === 'tasks' && permission.pendingCount > 0 && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 600, color: 'var(--accent)', background: 'color-mix(in oklch, var(--accent) 16%, transparent)', padding: '2px 7px', borderRadius: 9, margin: '0 10px 8px 0' }}>
              {permission.pendingCount}
            </div>
          )}
        </div>

        {rightTab === 'tasks' ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px 14px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
            {permission.queue.length === 0 && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-subtle)', padding: '8px 4px' }}>
                no pending approvals
              </div>
            )}
            {permission.queue.map((q, i) => {
              const meta = LEVEL_META[q.level ?? 'warning'];
              return (
                <div
                  key={q.id}
                  style={{
                    border: `1px solid color-mix(in oklch, ${meta.color} 30%, transparent)`,
                    borderRadius: 7, padding: '9px 10px',
                    background: `color-mix(in oklch, ${meta.color} 6%, var(--bg-card))`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span className={i === 0 ? 'aur-pulse' : undefined} style={{ width: 5, height: 5, borderRadius: '50%', background: meta.color }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, color: meta.color, textTransform: 'uppercase', letterSpacing: '.04em' }}>{meta.label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--text-subtle)', marginLeft: 'auto' }}>{q.tool}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text)', lineHeight: 1.4 }}>{q.summary ?? q.pattern}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ display: 'flex', gap: 4, padding: '8px 10px 4px' }}>
              <button onClick={() => openCreatePrompt('file')} style={fileActionButtonStyle}>+ file</button>
              <button onClick={() => openCreatePrompt('folder')} style={fileActionButtonStyle}>+ folder</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px 8px', minHeight: 0 }}>
              {fileTree.files.length === 0 && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-subtle)', padding: '8px 4px' }}>
                  no files found
                </div>
              )}
              {fileTree.files.map((f) => (
                <div
                  key={f.path}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: `2px 6px 2px ${f.depth * 14}px`, borderRadius: 5 }}
                >
                  {renamingPath === f.path ? (
                    <input
                      autoFocus
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingPath(null); }}
                      onBlur={commitRename}
                      style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12, padding: '2px 4px', background: 'var(--bg-deep)', border: '1px solid var(--accent)', borderRadius: 4, color: 'var(--text)' }}
                    />
                  ) : (
                    <>
                      <button
                        aria-label={f.type === 'file' ? `Open ${f.name}` : f.name}
                        disabled={f.type !== 'file'}
                        onClick={() => openFileTab(f.path)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, minHeight: 26, padding: 0, background: 'transparent', border: 'none', cursor: f.type === 'file' ? 'pointer' : 'default', textAlign: 'left' }}
                      >
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: f.changed ? 'var(--accent)' : 'var(--text-disabled)', width: 12, textAlign: 'center', flexShrink: 0 }}>
                          {f.type === 'dir' ? '▸' : f.changed ? '●' : '·'}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: f.type === 'dir' ? 'var(--text-muted)' : f.changed ? 'var(--text)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {f.name}
                        </span>
                      </button>
                      {f.type === 'file' && (
                        <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button aria-label={`Rename ${f.name}`} onClick={() => startRename(f.path)} style={fileIconButtonStyle}>✎</button>
                          <button aria-label={`Delete ${f.name}`} onClick={() => handleDeleteFile(f.path)} style={fileIconButtonStyle}>×</button>
                        </span>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {confirmAction && (
        <ConfirmDialog
          confirmLabel={confirmAction.confirmLabel}
          description={confirmAction.description}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => { const action = confirmAction.onConfirm; setConfirmAction(null); action(); }}
          title={confirmAction.title}
          tone="danger"
        />
      )}
      {promptKind && (
        <PromptDialog
          confirmLabel={promptKind === 'file' ? 'Create file' : 'Create folder'}
          description="The path is relative to the active workspace."
          label={`${promptKind === 'file' ? 'File' : 'Folder'} path`}
          onCancel={() => setPromptKind(null)}
          onChange={setPromptValue}
          onConfirm={submitCreatePrompt}
          placeholder={promptKind === 'file' ? 'src/example.ts' : 'src/components'}
          title={`Create ${promptKind}`}
          value={promptValue}
        />
      )}
      {sessionRenameId && <PromptDialog title="Rename session" description="This changes only the local session title." label="Session title" placeholder="Project exploration" confirmLabel="Rename" value={sessionTitleDraft} onCancel={() => setSessionRenameId(null)} onChange={setSessionTitleDraft} onConfirm={commitSessionRename} />}
      {contextOpen && <ContextDrawer agent={agents.agents.find((agent) => agent.id === agents.agentId)?.name ?? 'Aurict'} provider={providers.providers.find((provider) => provider.id === modelSelection.providerId)?.name ?? 'Not configured'} model={modelSelection.models.find((model) => model.id === modelSelection.modelId)?.name ?? 'Not selected'} session={activeSession?.title ?? 'New local session'} attachments={chat.contextAttachments} sources={chat.contextSources} onClose={() => setContextOpen(false)} />}
      <ToastRegion onDismiss={dismissToast} toasts={toasts} />
    </div>
  );
}
