import { useCallback, useEffect, useState } from 'react';
import type { SessionInfo, SessionMessage } from '../../shared/ipc-types.js';

export function useSessions(onSelect: (messages: SessionMessage[]) => void, onNew?: () => void) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    window.aurict.session.list().then(setSessions).catch((error) => console.error('Failed to load sessions', error));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const select = useCallback((id: string) => {
    window.aurict.session.select(id).then((messages) => {
      setActiveId(id);
      onSelect(messages);
    }).catch((error) => console.error('Failed to open session', error));
  }, [onSelect]);

  const create = useCallback(() => {
    window.aurict.session.create().then((id) => {
      setActiveId(id);
      onNew?.();
      refresh();
    }).catch((error) => console.error('Failed to create session', error));
  }, [onNew, refresh]);

  const remove = useCallback((id: string) => {
    window.aurict.session.remove(id).then(({ wasActive }) => {
      if (wasActive) {
        setActiveId(null);
        onNew?.();
      }
      refresh();
    }).catch((error) => console.error('Failed to remove session', error));
  }, [onNew, refresh]);

  return { sessions, activeId, refresh, select, create, remove };
}
