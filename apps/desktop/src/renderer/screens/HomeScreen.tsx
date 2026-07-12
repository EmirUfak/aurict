import React, { useMemo, useState } from 'react';
import type { UserType } from '../../shared/ipc-types.js';
import type { useChat } from '../hooks/useChat.js';
import { ModelSelector } from '../components/ModelSelector.js';
import { displayMessageText } from '../types.js';

interface Props {
  chat: ReturnType<typeof useChat>;
  userType: UserType;
}

type HomeContent = {
  eyebrow: string;
  title: string;
  detail: string;
  placeholder: string;
  prompts: Array<{ title: string; detail: string; prompt: string }>;
};

const CONTENT: Record<UserType, HomeContent> = {
  general: {
    eyebrow: 'Your local thinking space',
    title: 'What would you like to make clearer?',
    detail: 'Explore an idea, plan a task, research a question, or simply start a conversation. Aurict adapts as the work becomes more specific.',
    placeholder: 'Ask a question or describe what you want to accomplish…',
    prompts: [
      { title: 'Explore an idea', detail: 'Turn a rough thought into useful next steps.', prompt: 'Help me explore this idea: ' },
      { title: 'Plan something', detail: 'Create a practical, calm plan for a goal.', prompt: 'Help me plan: ' },
      { title: 'Understand a topic', detail: 'Get a clear explanation with the right depth.', prompt: 'Explain this topic clearly: ' },
    ],
  },
  developer: {
    eyebrow: 'Calm developer home',
    title: 'Start with the outcome, then open the workspace.',
    detail: 'Use this focused surface for a question or a plan. The full code workspace remains one click away in your preferred starting surface.',
    placeholder: 'Describe the code outcome you want…',
    prompts: [
      { title: 'Plan a change', detail: 'Map a safe implementation before editing.', prompt: 'Plan this code change: ' },
      { title: 'Review a problem', detail: 'Investigate an error or unexpected behavior.', prompt: 'Help me diagnose: ' },
      { title: 'Learn a system', detail: 'Understand an unfamiliar part of a project.', prompt: 'Explain this codebase area: ' },
    ],
  },
  product: {
    eyebrow: 'Product home',
    title: 'Move a product question toward a decision.',
    detail: 'Start from a customer problem, a product bet, or a decision that needs clearer trade-offs.',
    placeholder: 'Describe the product outcome or decision…',
    prompts: [
      { title: 'Shape a feature', detail: 'Clarify users, constraints, and success signals.', prompt: 'Help me shape this feature: ' },
      { title: 'Compare options', detail: 'Make trade-offs explicit before deciding.', prompt: 'Compare these product options: ' },
      { title: 'Write a brief', detail: 'Turn context into a build-ready narrative.', prompt: 'Draft a product brief for: ' },
    ],
  },
  designer: {
    eyebrow: 'Creative home',
    title: 'Find a direction before opening the canvas.',
    detail: 'Describe the audience, feeling, and constraints. When you are ready, move into the Design Studio for artifacts and iterations.',
    placeholder: 'Describe the visual direction you want to explore…',
    prompts: [
      { title: 'Find a visual direction', detail: 'Create a focused direction from a rough brief.', prompt: 'Help me find a visual direction for: ' },
      { title: 'Prepare a design brief', detail: 'Clarify audience, screens, and system cues.', prompt: 'Create a design brief for: ' },
      { title: 'Review a flow', detail: 'Find friction and opportunities in an experience.', prompt: 'Review this user flow: ' },
    ],
  },
  operator: {
    eyebrow: 'Operations home',
    title: 'Make the next piece of work easier to run.',
    detail: 'Bring a recurring process, a document, or a business question. Aurict can turn it into a clear routine.',
    placeholder: 'Describe the work you want to organize…',
    prompts: [
      { title: 'Improve a routine', detail: 'Find bottlenecks and practical improvements.', prompt: 'Improve this workflow: ' },
      { title: 'Prepare a document', detail: 'Start from the audience and desired outcome.', prompt: 'Help me prepare: ' },
      { title: 'Analyze a process', detail: 'Turn operational detail into clear actions.', prompt: 'Analyze this process: ' },
    ],
  },
  finance: {
    eyebrow: 'Research home',
    title: 'Ask a question worth an audit trail.',
    detail: 'For market research or calculations, Aurict will retain assumptions, formulas, sources, and dates in the Finance Desk.',
    placeholder: 'Ask a research or calculation question…',
    prompts: [
      { title: 'Research an instrument', detail: 'Start with sources and time sensitivity.', prompt: 'Research this financial question: ' },
      { title: 'Explain a formula', detail: 'See inputs, assumptions, and a reusable trail.', prompt: 'Explain and calculate: ' },
      { title: 'Compare scenarios', detail: 'Make assumptions visible before reading a result.', prompt: 'Compare these financial scenarios: ' },
    ],
  },
};

export function HomeScreen({ chat, userType }: Props) {
  const content = CONTENT[userType];
  const [draft, setDraft] = useState('');
  const recentMessages = useMemo(() => chat.messages.slice(-3), [chat.messages]);

  const send = () => {
    const question = draft.trim();
    if (!question || chat.pending) return;
    chat.submit(question);
    setDraft('');
  };

  return <main style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: 'var(--bg)' }}>
    <div style={{ width: 'min(900px, 100%)', margin: '0 auto', padding: '64px 32px 56px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--accent)' }}>{content.eyebrow}</div>
      <h1 style={{ maxWidth: 700, margin: '12px 0 0', fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 42, lineHeight: 1.06, color: 'var(--text)' }}>{content.title}</h1>
      <p style={{ maxWidth: 660, margin: '16px 0 0', fontFamily: 'var(--font-serif)', fontSize: 17, lineHeight: 1.55, color: 'var(--text-muted)' }}>{content.detail}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginTop: 34 }}>
        {content.prompts.map((prompt) => <button key={prompt.title} type="button" onClick={() => setDraft(prompt.prompt)} style={{ minHeight: 118, padding: 16, textAlign: 'left', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 10, cursor: 'pointer' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--text)' }}>{prompt.title}</div>
          <div style={{ marginTop: 7, fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.5, color: 'var(--text-muted)' }}>{prompt.detail}</div>
        </button>)}
      </div>
      <ModelSelector />

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginTop: 18, padding: '10px 10px 10px 16px', background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 11 }}>
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder={content.placeholder} rows={2} style={{ flex: 1, minWidth: 0, resize: 'vertical', fontFamily: 'var(--font-serif)', fontSize: 16, lineHeight: 1.45, color: 'var(--text)', background: 'transparent', border: 'none' }} />
        <button type="button" onClick={send} disabled={chat.pending || !draft.trim()} style={{ alignSelf: 'flex-end', padding: '9px 15px', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: chat.pending || !draft.trim() ? 'var(--text-subtle)' : 'var(--accent-ink)', background: chat.pending || !draft.trim() ? 'var(--control-hover)' : 'var(--accent)', border: 'none', borderRadius: 7, cursor: chat.pending || !draft.trim() ? 'default' : 'pointer' }}>{chat.pending ? 'working…' : 'send ↵'}</button>
      </div>
      {chat.pending && <div role="status" className="aur-inline-status">{chat.statusMessage ?? 'Aurict is working…'} <button type="button" className="aur-text-action" onClick={chat.cancel}>stop</button></div>}

      {recentMessages.length > 0 && <section style={{ marginTop: 42 }} aria-labelledby="recent-conversation">
        <div id="recent-conversation" style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: 10 }}>Recent conversation</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recentMessages.map((message) => <div key={message.id} style={{ padding: '12px 14px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
            <div style={{ marginBottom: 4, fontFamily: 'var(--font-mono)', fontSize: 10.5, color: message.role === 'error' ? 'var(--danger)' : message.role === 'user' ? 'var(--accent)' : 'var(--text-subtle)', textTransform: 'uppercase' }}>{message.role}</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 14.5, lineHeight: 1.5, color: message.role === 'error' ? 'var(--danger)' : 'var(--text)' }}>{displayMessageText(message) || (message.pending ? 'Working…' : '')}</div>
          </div>)}
        </div>
      </section>}
    </div>
  </main>;
}
