import { useCallback, useEffect, useState } from 'react';
import type { SessionInfo, SessionMessage, SessionSearchResult } from '../../shared/ipc-types.js';

export function useSessions(onSelect: (messages: SessionMessage[]) => void, onNew?: () => void) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SessionSearchResult[]>([]);

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
  const rename = useCallback(async (id: string, title: string) => {
    const result = await window.aurict.session.rename(id, title);
    setSessions((current) => current.map((session) => session.id === id ? { ...session, title: result.title, updatedAt: Date.now() } : session));
  }, []);
  const archive = useCallback(async (id: string, archived: boolean) => {
    await window.aurict.session.archive(id, archived);
    setSessions((current) => current.map((session) => session.id === id ? { ...session, status: archived ? 'archived' : 'complete', updatedAt: Date.now() } : session));
  }, []);
  const branch = useCallback(async (id: string) => {
    const result = await window.aurict.session.branch(id);
    setActiveId(result.id); onSelect(result.messages); refresh();
  }, [onSelect, refresh]);
  const search = useCallback(async (query: string) => { setSearchResults(query.trim() ? await window.aurict.session.search(query) : []); }, []);

  return { sessions, activeId, refresh, select, create, remove, rename, archive, branch, search, searchResults };
}
