import React, { useState } from 'react';
import type { UserType } from '../../shared/ipc-types.js';
import type { useChat } from '../hooks/useChat.js';
import { ModelSelector } from '../components/ModelSelector.js';
import { ChatTimeline } from '../components/ChatTimeline.js';
import { useToasts, ToastRegion } from '../components/ToastRegion.js';

type Role = Extract<UserType, 'product' | 'operator'>;

const CONTENT: Record<Role, { eyebrow: string; title: string; detail: string; placeholder: string; templates: Array<{ title: string; detail: string; prompt: string }> }> = {
  product: {
    eyebrow: 'Product hub', title: 'Turn product context into a clear decision.',
    detail: 'Start from the customer problem, make trade-offs explicit, then carry the result into a brief or design exploration.',
    placeholder: 'Describe the customer, decision, or outcome you need to clarify…',
    templates: [
      { title: 'Shape a feature', detail: 'Users, constraints, success signals.', prompt: 'Help me shape this product feature. Start with the user problem, constraints, alternatives, success signals, and open questions: ' },
      { title: 'Make a decision', detail: 'Compare options and trade-offs.', prompt: 'Help me make this product decision. Compare the options, trade-offs, risks, and a recommended next step: ' },
      { title: 'Write a brief', detail: 'Create a build-ready narrative.', prompt: 'Create a concise product brief with problem, audience, scope, non-goals, acceptance criteria, and open questions: ' },
    ],
  },
  operator: {
    eyebrow: 'Operations desk', title: 'Make recurring work easier to run.',
    detail: 'Turn a process, document, or business question into a dependable routine with clear owners, inputs, and next actions.',
    placeholder: 'Describe the process, report, or routine you want to improve…',
    templates: [
      { title: 'Improve a routine', detail: 'Find friction and a simpler sequence.', prompt: 'Improve this recurring workflow. Identify inputs, owners, bottlenecks, controls, and a practical new routine: ' },
      { title: 'Prepare a document', detail: 'Start from audience and outcome.', prompt: 'Help me prepare this operational document. Clarify its audience, purpose, required facts, structure, and review checklist: ' },
      { title: 'Analyze a process', detail: 'Turn detail into actions.', prompt: 'Analyze this business process. Summarize the current state, failure points, risks, metrics, and prioritized improvements: ' },
    ],
  },
};

interface Props { role: Role; chat: ReturnType<typeof useChat>; onOpenDesign: () => void; }

export function RoleWorkspaceScreen({ role, chat, onOpenDesign }: Props) {
  const content = CONTENT[role];
  const [draft, setDraft] = useState('');
  const { toasts, show: showToast, dismiss: dismissToast } = useToasts();
  const submit = () => {
    const value = draft.trim();
    if (!value || chat.pending) return;
    chat.submit(value);
    setDraft('');
  };

  return <main className="aur-role-workspace" style={{ position: 'relative' }}>
    <ChatTimeline
      activities={chat.activities}
      contentStyle={{ maxWidth: 920, padding: 'clamp(28px, 5vw, 72px) clamp(20px, 6vw, 96px) 32px' }}
      intro={<section className="aur-role-hero"><div className="aur-role-eyebrow">{content.eyebrow}</div><h1>{content.title}</h1><p>{content.detail}</p><div className="aur-role-templates">{content.templates.map((template) => <button key={template.title} type="button" onClick={() => setDraft(template.prompt)}><strong>{template.title}</strong><span>{template.detail}</span></button>)}</div>{role === 'product' && <button type="button" className="aur-text-action" onClick={onOpenDesign}>Open Design Studio for a prototype →</button>}</section>}
      messages={chat.messages}
      onRetry={chat.retryLast}
      pending={chat.pending}
    />
    <section className="aur-role-conversation" aria-label="Working conversation">
      <div className="aur-role-composer">
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } }} placeholder={content.placeholder} rows={3} />
        <div><span>{chat.pending ? chat.statusMessage ?? 'Aurict is working…' : 'Enter to send · Shift+Enter for a new line'}</span><button type="button" className="aur-button aur-button-primary" disabled={!draft.trim() || chat.pending} onClick={submit}>{chat.pending ? 'working…' : 'send'}</button></div>
        <ModelSelector showToast={showToast} dismissToast={dismissToast} />
      </div>
    </section>
    <ToastRegion toasts={toasts} onDismiss={dismissToast} />
  </main>;
}
