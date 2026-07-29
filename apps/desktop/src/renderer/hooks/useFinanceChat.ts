import { useCallback, useEffect, useRef, useState } from 'react';
import type { FinanceConversation, FinanceConversationMessage, FinanceResearchAudit } from '../../shared/ipc-types.js';
import type { AssistantBlock, DisplayMessage } from '../types.js';
import { summarizeToolArgs } from '../types.js';
import type { ChatActivity } from './useChat.js';

function toDisplayMessage(message: FinanceConversationMessage): DisplayMessage {
  return { id: message.id, role: message.role, content: message.content, ...(message.blocks ? { blocks: message.blocks } : {}) };
}

function toSavedMessage(message: DisplayMessage): FinanceConversationMessage {
  return {
    id: message.id,
    role: message.role === 'error' ? 'error' : message.role === 'assistant' ? 'assistant' : 'user',
    content: message.content,
    createdAt: Date.now(),
    ...(message.blocks ? { blocks: message.blocks } : {}),
  };
}

export function useFinanceChat() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [activities, setActivities] = useState<ChatActivity[]>([]);
  const [pending, setPending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [audit, setAudit] = useState<FinanceResearchAudit | undefined>();
  const [error, setError] = useState<string | null>(null);
  const messagesRef = useRef<DisplayMessage[]>([]);
  const activeTurnId = useRef<string | null>(null);
  const activeConversationId = useRef<string | null>(null);
  const streamText = useRef('');
  const assistantId = useRef<string | null>(null);
  const assistantBlocks = useRef<AssistantBlock[]>([]);
  const lastPrompt = useRef<string | null>(null);

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const loadConversation = useCallback((conversation: FinanceConversation | null) => {
    activeConversationId.current = conversation?.id ?? null;
    activeTurnId.current = null;
    assistantId.current = null;
    assistantBlocks.current = [];
    streamText.current = '';
    setMessages(conversation?.messages.map(toDisplayMessage) ?? []);
    setAudit(conversation?.audit);
    setActivities([]);
    setPending(false);
    setStatusMessage(null);
    setError(conversation?.error ?? null);
  }, []);

  const addActivity = useCallback((activity: Omit<ChatActivity, 'id'> & { id?: string }) => {
    setActivities((current) => [...current, { ...activity, id: activity.id ?? crypto.randomUUID() }].slice(-12));
  }, []);

  useEffect(() => window.aurict.chat.onEvent((event) => {
    if (!('turnId' in event) || event.turnId !== activeTurnId.current) return;
    if (event.type === 'phase') {
      const labels = { accepted: 'Finance Desk received the request.', preparing_attachments: 'Reading attachments…', preparing_context: 'Preparing finance context…', resolving_model: 'Preparing model…', waiting_for_provider: 'Waiting for the model…' } as const;
      setStatusMessage(labels[event.phase]);
      addActivity({ label: labels[event.phase], status: 'active' });
      return;
    }
    if (event.type === 'text-delta') {
      if (event.isReasoning) return;
      streamText.current += event.delta;
      const id = assistantId.current ?? crypto.randomUUID();
      assistantId.current = id;
      setMessages((current) => {
        const previous = current.find((message) => message.id === id);
        const blocks: AssistantBlock[] = assistantBlocks.current;
        const last = blocks[blocks.length - 1];
        const nextBlocks = last?.type === 'text'
          ? [...blocks.slice(0, -1), { type: 'text' as const, content: streamText.current }]
          : [...blocks, { type: 'text' as const, content: streamText.current }];
        assistantBlocks.current = nextBlocks;
        const next = { id, role: 'assistant' as const, content: '', blocks: nextBlocks, pending: true };
        return previous ? current.map((message) => message.id === id ? next : message) : [...current, next];
      });
      return;
    }
    if (event.type === 'tool-call') {
      const id = assistantId.current ?? crypto.randomUUID();
      assistantId.current = id;
      streamText.current = '';
      setMessages((current) => {
        const previous = current.find((message) => message.id === id);
        const blocks = [...assistantBlocks.current, { type: 'tool' as const, id: event.id, tool: event.tool, argsSummary: summarizeToolArgs(event.args), pending: true }];
        assistantBlocks.current = blocks;
        const next = {
          id,
          role: 'assistant' as const,
          content: '',
          blocks,
          pending: true,
        };
        return previous ? current.map((message) => message.id === id ? next : message) : [...current, next];
      });
      addActivity({ id: event.id, label: `${event.tool} is running`, detail: summarizeToolArgs(event.args), status: 'active' });
      return;
    }
    if (event.type === 'tool-result') {
      assistantBlocks.current = assistantBlocks.current.map((block) => block.type === 'tool' && block.id === event.id ? { ...block, pending: false, result: event.result, durationMs: event.durationMs } : block);
      setMessages((current) => current.map((message) => {
        if (message.id !== assistantId.current || !message.blocks) return message;
        return {
          ...message,
          blocks: assistantBlocks.current,
        };
      }));
      setActivities((current) => current.map((activity) => activity.id === event.id ? { ...activity, status: 'complete' } : activity));
      return;
    }
    if (event.type === 'finance-research-audit') {
      setAudit(event.audit);
      addActivity({ label: 'Source audit saved', detail: `${event.audit.sources.length} sources`, status: 'complete' });
      return;
    }
    if (event.type === 'finish') {
      const conversationId = activeConversationId.current;
      const id = assistantId.current ?? crypto.randomUUID();
      assistantId.current = id;
      const blocks = assistantBlocks.current.length > 0 ? assistantBlocks.current : (event.text.trim() ? [{ type: 'text' as const, content: event.text }] : []);
      const completed: DisplayMessage = { id, role: 'assistant', content: '', blocks, pending: false };
      setMessages((current) => {
        const existing = current.find((message) => message.id === id);
        return existing ? current.map((message) => message.id === id ? completed : message) : [...current, completed];
      });
      if (conversationId) {
        void window.aurict.finance.completeConversation(conversationId, toSavedMessage(completed)).catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
      }
      activeTurnId.current = null;
      streamText.current = '';
      setPending(false);
      setStatusMessage(null);
      setActivities((current) => current.map((activity) => activity.status === 'active' ? { ...activity, status: 'complete' } : activity));
      return;
    }
    if (event.type === 'error') {
      const conversationId = activeConversationId.current;
      const message = event.message;
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'error', content: message }]);
      if (conversationId) void window.aurict.finance.failConversation(conversationId, message, /abort|cancel/i.test(message)).catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
      activeTurnId.current = null;
      setPending(false);
      setStatusMessage(null);
      setError(message);
      setActivities((current) => current.map((activity) => activity.status === 'active' ? { ...activity, status: 'failed' } : activity));
    }
  }), [addActivity]);

  const submit = useCallback((conversation: FinanceConversation, prompt: string) => {
    const text = prompt.trim();
    if (!text || pending) return false;
    const history = conversation.messages.filter((message) => message.role === 'user' || message.role === 'assistant').map((message) => ({ role: message.role as 'user' | 'assistant', content: message.content || message.blocks?.filter((block) => block.type === 'text').map((block) => block.content).join('\n\n') || '' })).filter((message) => message.content.trim());
    const user: DisplayMessage = { id: crypto.randomUUID(), role: 'user', content: text };
    setMessages((current) => [...current, user]);
    void window.aurict.finance.appendConversationMessage(conversation.id, toSavedMessage(user)).catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
    const turnId = crypto.randomUUID();
    activeConversationId.current = conversation.id;
    activeTurnId.current = turnId;
    assistantId.current = null;
    assistantBlocks.current = [];
    streamText.current = '';
    lastPrompt.current = text;
    setError(null);
    setPending(true);
    setStatusMessage('Preparing Finance Desk…');
    setActivities([{ id: crypto.randomUUID(), label: 'Preparing finance research', status: 'active' }]);
    window.aurict.chat.submit({ turnId, text, agentId: 'finance', displayText: text, financeResearchId: conversation.id, financeHistory: history });
    return true;
  }, [pending]);

  const cancel = useCallback(() => {
    if (activeTurnId.current) window.aurict.chat.cancel(activeTurnId.current);
  }, []);

  const retry = useCallback((conversation: FinanceConversation) => lastPrompt.current ? submit(conversation, lastPrompt.current) : false, [submit]);

  return { messages, activities, pending, statusMessage, audit, error, loadConversation, submit, cancel, retry };
}
