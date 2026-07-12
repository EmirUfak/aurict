import { useCallback, useEffect, useState } from 'react';
import type { PermissionRequestPayload, PermissionDecision } from '../../shared/ipc-types.js';

export function usePermission() {
  const [queue, setQueue] = useState<PermissionRequestPayload[]>([]);

  useEffect(() => {
    return window.aurict.permission.onRequest((request) => {
      setQueue((prev) => [...prev, request]);
    });
  }, []);

  const respond = useCallback((decision: PermissionDecision) => {
    setQueue((prev) => {
      const [current, ...rest] = prev;
      if (current) window.aurict.permission.respond(current.id, decision);
      return rest;
    });
  }, []);

  return { current: queue[0] ?? null, queue, pendingCount: queue.length, respond };
}
