import type { CSSProperties, ReactNode } from 'react';
import type { ChatActivity } from '../hooks/useChat.js';
import { useChatAutoScroll } from '../hooks/useChatAutoScroll.js';
import type { DisplayMessage } from '../types.js';
import { ChatTranscript } from './ChatTranscript.js';
import { TaskActivity } from './TaskActivity.js';

interface Props {
  sessionId?: string | null;
  messages: DisplayMessage[];
  activities: ChatActivity[];
  pending: boolean;
  onRetry: () => boolean;
  intro?: ReactNode;
  empty?: ReactNode;
  contentStyle?: CSSProperties;
}

export function ChatTimeline({ sessionId = null, messages, activities, pending, onRetry, intro, empty, contentStyle }: Props) {
  const chatScroll = useChatAutoScroll({ sessionId, messages, activities, pending });

  return <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
    <div ref={chatScroll.viewportRef} onScroll={chatScroll.onScroll} style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ maxWidth: 920, minHeight: '100%', margin: '0 auto', padding: '32px', display: 'flex', flexDirection: 'column', gap: 20, ...contentStyle }}>
        {intro}
        {messages.length === 0 && empty}
        <TaskActivity activities={activities} pending={pending} />
        <ChatTranscript messages={messages} onRetry={onRetry} />
      </div>
    </div>
    {chatScroll.showJumpToLatest && (
      <button type="button" onClick={chatScroll.scrollToLatest} style={{ position: 'absolute', right: 32, bottom: 16, zIndex: 1, padding: '6px 9px', color: 'var(--text)', background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 6, boxShadow: '0 8px 20px color-mix(in srgb, black 18%, transparent)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>
        latest ↓
      </button>
    )}
  </div>;
}
