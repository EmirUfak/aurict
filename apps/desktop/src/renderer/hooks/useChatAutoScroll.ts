import { useCallback, useLayoutEffect, useRef, useState, type UIEventHandler } from 'react';

const BOTTOM_TOLERANCE_PX = 48;

export function isNearBottom(element: Pick<HTMLDivElement, 'scrollHeight' | 'scrollTop' | 'clientHeight'>): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= BOTTOM_TOLERANCE_PX;
}

interface ChatAutoScrollOptions {
  sessionId: string | null;
  messages: unknown[];
  activities: unknown[];
  pending: boolean;
}

export function useChatAutoScroll({ sessionId, messages, activities, pending }: ChatAutoScrollOptions) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const followsLatestRef = useRef(true);
  const wasPendingRef = useRef(pending);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const scrollToLatest = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    followsLatestRef.current = true;
    viewport.scrollTop = viewport.scrollHeight;
    setShowJumpToLatest(false);
  }, []);

  const onScroll = useCallback<UIEventHandler<HTMLDivElement>>((event) => {
    const followsLatest = isNearBottom(event.currentTarget);
    followsLatestRef.current = followsLatest;
    setShowJumpToLatest(!followsLatest);
  }, []);

  useLayoutEffect(() => {
    followsLatestRef.current = true;
    setShowJumpToLatest(false);
  }, [sessionId]);

  useLayoutEffect(() => {
    if (pending && !wasPendingRef.current) scrollToLatest();
    wasPendingRef.current = pending;
  }, [pending, scrollToLatest]);

  useLayoutEffect(() => {
    if (!followsLatestRef.current) return;
    const frame = window.requestAnimationFrame(scrollToLatest);
    return () => window.cancelAnimationFrame(frame);
  }, [messages, activities, pending, scrollToLatest]);

  return { viewportRef, onScroll, scrollToLatest, showJumpToLatest };
}
