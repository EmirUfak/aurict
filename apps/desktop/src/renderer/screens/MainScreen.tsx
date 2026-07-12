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
import type { DisplayMessage, AssistantBlock } from '../types.js';
import type { SessionInfo, UserType } from '../../shared/ipc-types.js';

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

function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

interface MainScreenProps {
  permission: ReturnType<typeof usePermission>;
  chat: ReturnType<typeof useChat>;
  sessions: ReturnType<typeof useSessions>;
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

export function MainScreen({ permission, chat, sessions, userType }: MainScreenProps) {
  const fileTree = useFileTree();
  const providers = useProviders();
  const modelSelection = useModelSelection();
  const agents = useAgents();
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
  const { toasts, show: showToast, dismiss: dismissToast } = useToasts();
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
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {sessions.sessions.length === 0 && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-subtle)', padding: '8px 10px' }}>
              no sessions yet
            </div>
          )}
          {sessions.sessions.map((s) => {
            const active = s.id === sessions.activeId;
            return (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => sessions.select(s.id)}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); sessions.select(s.id); } }}
                style={{
                  width: '100%', padding: '9px 10px', borderRadius: 6, cursor: 'pointer',
                  background: active ? 'color-mix(in oklch, var(--accent) 12%, transparent)' : 'transparent',
                  borderLeft: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: active ? 'var(--text)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                    {s.title ?? 'untitled session'}
                  </div>
                  {active && <span className="aur-pulse" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}
                  <button
                    type="button"
                    aria-label={`Delete ${s.title ?? 'session'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmAction({
                        title: 'Delete session?',
                        description: `Delete ${s.title ?? 'this session'} and its local conversation history?`,
                        confirmLabel: 'Delete session',
                        onConfirm: () => sessions.remove(s.id),
                      });
                    }}
                    style={{ minHeight: 20, padding: 0, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-subtle)', background: 'transparent', border: 'none', flexShrink: 0, cursor: 'pointer' }}
                  >
                    ×
                  </button>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-subtle)', marginTop: 2 }}>
                  {formatRelativeTime(s.updatedAt)} · {s.turnCount} turn{s.turnCount === 1 ? '' : 's'}{s.lastModel ? ` · ${s.lastModel}` : ''}
                </div>
              </div>
            );
          })}
        </div>
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
          <CenterTabButton label="chat" active={activeCenterTab === 'chat'} onClick={() => setActiveCenterTab('chat')} />
          {openFiles.map((path) => (
            <CenterTabButton
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
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px 8px' }}>
              <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {chat.messages.length === 0 && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-subtle)', textAlign: 'center', marginTop: 40 }}>
                    {profileCopy.empty}
                  </div>
                )}
                {chat.messages.map((m) => (
                  <ChatBubble key={m.id} message={m} {...(m.role === 'error' ? { onRetry: chat.retryLast } : {})} />
                ))}
              </div>
            </div>

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
          <TabButton label="files" active={rightTab === 'files'} onClick={() => setRightTab('files')} />
          <TabButton label="tasks" active={rightTab === 'tasks'} onClick={() => setRightTab('tasks')} />
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
      <ToastRegion onDismiss={dismissToast} toasts={toasts} />
    </div>
  );
}

function SessionMetadata({ session }: { session: SessionInfo }) {
  const totalTokens = session.totalInputTokens + session.totalOutputTokens + session.totalCacheTokens;
  return <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-subtle)', display: 'grid', gap: 4 }}>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>session metadata</div>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, lineHeight: 1.45, color: 'var(--text-muted)' }}>status: {session.status} · updated {formatRelativeTime(session.updatedAt)}</div>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, lineHeight: 1.45, color: 'var(--text-muted)' }}>{session.provider ?? 'provider unknown'} · {session.lastModel ?? 'model pending'}</div>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, lineHeight: 1.45, color: 'var(--text-muted)' }}>{totalTokens.toLocaleString()} tokens · ${session.accumulatedCostUsd.toFixed(4)} cost</div>
    {session.parentId && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-subtle)' }}>child of {session.parentId.slice(0, 12)}</div>}
  </div>;
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, padding: '8px 4px', marginRight: 16,
        border: 'none', borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`, cursor: 'pointer',
        background: 'transparent', color: active ? 'var(--text)' : 'var(--text-muted)',
      }}
    >
      {label}
    </button>
  );
}

function CenterTabButton({ label, active, dirty, onClick, onClose }: { label: string; active: boolean; dirty?: boolean; onClick: () => void; onClose?: () => void }) {
  return (
    <div
      onClick={onClick}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick(); } }}
      aria-selected={active}
      role="tab"
      tabIndex={0}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', marginRight: 2,
        borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`, cursor: 'pointer', whiteSpace: 'nowrap',
      }}
    >
      {dirty && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 600, color: active ? 'var(--text)' : 'var(--text-muted)' }}>
        {label}
      </span>
      {onClose && (
        <button
          aria-label={`Close ${label}`}
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          style={{ minHeight: 20, padding: 0, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-subtle)', background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          ×
        </button>
      )}
    </div>
  );
}

function ChatBubble({ message, onRetry }: { message: DisplayMessage; onRetry?: () => boolean }) {
  if (message.role === 'user') {
    return (
      <div style={{ alignSelf: 'flex-end', maxWidth: '78%' }}>
        <div style={{ background: 'var(--bg-card)', borderRadius: '10px 10px 2px 10px', padding: '12px 16px', fontFamily: 'var(--font-serif)', fontSize: 15.5, lineHeight: 1.55, color: 'var(--text)' }}>
          {message.content}
        </div>
      </div>
    );
  }
  if (message.role === 'error') {
    return (
      <div style={{ maxWidth: '92%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--danger)' }}>
          <span>{message.content}</span>
          {onRetry && <button className="aur-text-action" onClick={onRetry} style={{ marginTop: 0 }}>retry last task</button>}
        </div>
      </div>
    );
  }
  return (
    <div style={{ maxWidth: '88%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>aurict</span>
        {message.pending && <span className="aur-pulse" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)' }} />}
        <CopyMessageButton message={message} />
      </div>
      {(message.blocks ?? []).map((block, i) => (
        <AssistantBlockView key={i} block={block} />
      ))}
    </div>
  );
}

function CopyMessageButton({ message }: { message: DisplayMessage }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const text = (message.blocks ?? []).map((block) => block.type === 'text' ? block.content : `${block.tool}: ${block.result ?? block.argsSummary}`).join('\n\n').trim();
    if (!text) return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_800);
    }).catch((error: unknown) => console.error('Failed to copy assistant message', error));
  };
  return <button type="button" onClick={copy} style={{ minHeight: 20, marginLeft: 'auto', padding: '0 3px', color: 'var(--text-subtle)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>{copied ? 'copied' : 'copy'}</button>;
}

function AssistantBlockView({ block }: { block: AssistantBlock }) {
  if (block.type === 'text') {
    return <div style={{ fontFamily: 'var(--font-serif)', fontSize: 15.5, lineHeight: 1.62, color: 'var(--text-muted)', marginBottom: 10, whiteSpace: 'pre-wrap' }}>{block.content}</div>;
  }
  return (
    <div style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-muted)' }}>{block.tool} · {block.argsSummary}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: block.pending ? 'var(--accent)' : 'var(--text-subtle)' }}>
          {block.pending ? 'running…' : block.durationMs !== undefined ? `${block.durationMs}ms` : 'done'}
        </div>
      </div>
      {block.result && (
        <div style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: 1.7, color: 'var(--text-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 220, overflowY: 'auto', borderTop: '1px solid var(--border-subtle)' }}>
          {block.result}
        </div>
      )}
    </div>
  );
}
