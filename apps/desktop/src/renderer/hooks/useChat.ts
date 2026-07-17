import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatAttachment, ChatEvent, FinanceResearchSource, SessionMessage } from '../../shared/ipc-types.js';
import type { DisplayMessage, AssistantBlock } from '../types.js';
import { summarizeToolArgs } from '../types.js';

export type ChatActivity = { id: string; label: string; detail?: string; status: 'active' | 'complete' | 'notice' | 'failed' };

function formatContextTokens(value: number): string {
  return value >= 1_000 ? `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}k` : String(value);
}

export function useChat() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activities, setActivities] = useState<ChatActivity[]>([]);
  const [contextAttachments, setContextAttachments] = useState<ChatAttachment[]>([]);
  const [contextSources, setContextSources] = useState<FinanceResearchSource[]>([]);
  const streamTextRef = useRef('');
  const turnIdRef = useRef<string | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const reasoningNotedRef = useRef(false);
  const lastSubmissionRef = useRef<Omit<Parameters<typeof window.aurict.chat.submit>[0], 'text' | 'turnId'> & { text: string } | null>(null);

  const ensureTurnMessage = useCallback((): string => {
    if (turnIdRef.current) return turnIdRef.current;
    const id = crypto.randomUUID();
    turnIdRef.current = id;
    setMessages((prev) => [...prev, { id, role: 'assistant', content: '', blocks: [], pending: true }]);
    return id;
  }, []);

  const updateTurn = useCallback((updater: (msg: DisplayMessage) => DisplayMessage) => {
    const id = turnIdRef.current;
    if (!id) return;
    setMessages((prev) => prev.map((m) => (m.id === id ? updater(m) : m)));
  }, []);

  const addActivity = useCallback((activity: Omit<ChatActivity, 'id'> & { id?: string }) => {
    setActivities((current) => [...current, { ...activity, id: activity.id ?? crypto.randomUUID() }].slice(-12));
  }, []);
  const resolveActivity = useCallback((id: string, status: ChatActivity['status'], detail?: string) => {
    setActivities((current) => current.map((item) => item.id === id ? { ...item, status, ...(detail ? { detail } : {}) } : item));
  }, []);

  useEffect(() => {
    const unsubscribe = window.aurict.chat.onEvent((event: ChatEvent) => {
      if ('turnId' in event && event.turnId !== activeRequestIdRef.current) return;
      switch (event.type) {
        case 'phase': {
          const statusByPhase = {
            accepted: 'Aurict accepted the task.',
            preparing_attachments: 'Reading the attached files…',
            preparing_context: 'Preparing project context…',
            resolving_model: 'Checking model capabilities…',
            waiting_for_provider: 'Waiting for the model to respond…',
          } as const;
          setStatusMessage(statusByPhase[event.phase]);
          addActivity({ label: statusByPhase[event.phase], status: 'active' });
          return;
        }
        case 'text-delta': {
          if (event.isReasoning) {
            if (!reasoningNotedRef.current) {
              reasoningNotedRef.current = true;
              addActivity({ label: 'Reviewing the task', detail: 'Checking constraints before responding', status: 'active' });
            }
            return;
          }
          ensureTurnMessage();
          streamTextRef.current += event.delta;
          const liveText = streamTextRef.current;
          updateTurn((m) => {
            const blocks = m.blocks ?? [];
            const last = blocks[blocks.length - 1];
            // Accumulating text-delta events replace the trailing text block;
            // a tool-call resets streamTextRef.current to '' and this block
            // becomes 'tool', so the next delta starts a fresh text block.
            const nextBlocks: AssistantBlock[] =
              last?.type === 'text'
                ? [...blocks.slice(0, -1), { type: 'text', content: liveText }]
                : [...blocks, { type: 'text', content: liveText }];
            return { ...m, blocks: nextBlocks };
          });
          return;
        }
        case 'tool-call': {
          ensureTurnMessage();
          streamTextRef.current = '';
          updateTurn((m) => ({
            ...m,
            blocks: [
              ...(m.blocks ?? []),
              { type: 'tool', id: event.id, tool: event.tool, argsSummary: summarizeToolArgs(event.args), pending: true },
            ],
          }));
          addActivity({ id: event.id, label: `Using ${event.tool}`, detail: summarizeToolArgs(event.args), status: 'active' });
          return;
        }
        case 'tool-result': {
          updateTurn((m) => ({
            ...m,
            blocks: (m.blocks ?? []).map((b) =>
              b.type === 'tool' && b.id === event.id
                ? { ...b, pending: false, result: event.result, durationMs: event.durationMs }
                : b,
            ),
          }));
          resolveActivity(event.id, 'complete');
          return;
        }
        case 'finish': {
          updateTurn((m) => {
            const blocks = m.blocks ?? [];
            const hasText = blocks.some((block) => block.type === 'text' && block.content.trim());
            return {
              ...m,
              pending: false,
              blocks: !hasText && event.text.trim() ? [...blocks, { type: 'text', content: event.text }] : blocks,
            };
          });
          streamTextRef.current = '';
          reasoningNotedRef.current = false;
          turnIdRef.current = null;
          activeRequestIdRef.current = null;
          setPending(false);
          setStatusMessage(null);
          setActivities((current) => current.map((item) => item.status === 'active' ? { ...item, status: 'complete' } : item));
          return;
        }
        case 'error': {
          updateTurn((m) => ({ ...m, pending: false }));
          setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'error', content: event.message }]);
          streamTextRef.current = '';
          reasoningNotedRef.current = false;
          turnIdRef.current = null;
          activeRequestIdRef.current = null;
          setPending(false);
          setStatusMessage(null);
          setActivities((current) => current.map((item) => item.status === 'active' ? { ...item, status: 'failed' } : item));
          addActivity({ label: 'Task needs attention', detail: event.message, status: 'failed' });
          return;
        }
        case 'compaction': {
          const detail = `${formatContextTokens(event.beforeTokens)} → ${formatContextTokens(event.afterTokens)} tokens; compacted before ${formatContextTokens(event.threshold)}.`;
          setStatusMessage(`Aurict condensed earlier context (${detail})`);
          addActivity({ label: 'Context condensed', detail, status: 'notice' });
          return;
        }
        case 'finance-research-audit':
          setContextSources(event.audit.sources);
          addActivity({ label: 'Sources recorded', detail: `${event.audit.sources.length} source${event.audit.sources.length === 1 ? '' : 's'} added to this task`, status: 'complete' });
          return;
        case 'provider-fallback':
          setStatusMessage(`Continuing with ${event.to}; ${event.from} was unavailable.`);
          addActivity({ label: 'Model fallback', detail: `Continuing with ${event.to}`, status: 'notice' });
          return;
        case 'stream-restart':
          setStatusMessage('Reconnecting the response stream…');
          addActivity({ label: 'Reconnecting response', status: 'active' });
          return;
        case 'chunk':
        case 'step-finish':
        case 'artifact:updated':
          return; // not surfaced in Faz 3's MVP UI
      }
    });
    return unsubscribe;
  }, [addActivity, ensureTurnMessage, resolveActivity, updateTurn]);

  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => {
      if (!activeRequestIdRef.current) return;
      setStatusMessage('This is taking longer than usual. You can cancel safely while Aurict waits for the model.');
      addActivity({ label: 'Still waiting for the model', detail: 'No response has arrived yet', status: 'notice' });
    }, 20_000);
    return () => clearTimeout(timer);
  }, [addActivity, pending]);

  const submit = useCallback((text: string, agentId?: string, artifactId?: string, displayText?: string, artifactIntent?: 'create' | 'iterate' | 'promote', attachments?: ChatAttachment[], financeResearchId?: string) => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', content: displayText?.trim() || trimmed }]);
    streamTextRef.current = '';
    turnIdRef.current = null;
    const requestId = crypto.randomUUID();
    activeRequestIdRef.current = requestId;
    reasoningNotedRef.current = false;
    setPending(true);
    setStatusMessage('Aurict is preparing the task…');
    setActivities([{ id: crypto.randomUUID(), label: 'Preparing the task', detail: 'Setting up the requested work', status: 'active' }]);
    setContextAttachments(attachments ?? []);
    setContextSources([]);
    const payload = { turnId: requestId, text: trimmed, ...(agentId ? { agentId } : {}), ...(artifactId ? { artifactId } : {}), ...(displayText ? { displayText } : {}), ...(artifactIntent ? { artifactIntent } : {}), ...(attachments?.length ? { attachments } : {}), ...(financeResearchId ? { financeResearchId } : {}) };
    lastSubmissionRef.current = { text: trimmed, ...(agentId ? { agentId } : {}), ...(artifactId ? { artifactId } : {}), ...(displayText ? { displayText } : {}), ...(artifactIntent ? { artifactIntent } : {}), ...(attachments?.length ? { attachments } : {}), ...(financeResearchId ? { financeResearchId } : {}) };
    window.aurict.chat.submit(payload);
  }, [pending]);

  const resetForNewSession = useCallback(() => {
    setMessages([]);
    streamTextRef.current = '';
    turnIdRef.current = null;
    activeRequestIdRef.current = null;
    reasoningNotedRef.current = false;
    setPending(false);
    setStatusMessage(null);
    setActivities([]);
    setContextAttachments([]);
    setContextSources([]);
  }, []);

  const cancel = useCallback(() => {
    const requestId = activeRequestIdRef.current;
    if (pending && requestId) window.aurict.chat.cancel(requestId);
  }, [pending]);

  const retryLast = useCallback(() => {
    const submission = lastSubmissionRef.current;
    if (!submission || pending) return false;
    const { text, agentId, artifactId, displayText, artifactIntent, attachments, financeResearchId } = submission;
    submit(text, agentId, artifactId, displayText, artifactIntent, attachments, financeResearchId);
    return true;
  }, [pending, submit]);

  const restoreHistory = useCallback((history: SessionMessage[]) => {
    streamTextRef.current = '';
    turnIdRef.current = null;
    activeRequestIdRef.current = null;
    setPending(false);
    setStatusMessage(null);
    setActivities([]);
    setMessages(history.map((m) => ({ id: crypto.randomUUID(), role: m.role, content: m.content })));
  }, []);

  return { messages, pending, statusMessage, activities, contextAttachments, contextSources, submit, cancel, retryLast, resetForNewSession, restoreHistory };
}
