import { useCallback, useEffect, useState } from 'react';
import type { SessionInfo, SessionMessage, SessionSearchResult } from '../../shared/ipc-types.js';

export function useSessions(onSelect: (messages: SessionMessage[]) => void, onNew?: () => void) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SessionSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null);

  const fail = useCallback((reason: unknown, fallback: string, retry: (() => void) | null) => {
    console.error(fallback, reason);
    setError(reason instanceof Error ? reason.message : fallback);
    setRetryAction(() => retry);
  }, []);
  const succeed = useCallback(() => { setError(null); setRetryAction(null); }, []);

  const refresh = useCallback(() => {
    window.aurict.session.list().then((next) => { setSessions(next); succeed(); }).catch((reason) => fail(reason, 'Sessions could not be loaded.', refresh));
  }, [fail, succeed]);

  useEffect(() => { refresh(); }, [refresh]);

  // select/remove: safe to retry (re-opening or re-deleting the same id is
  // harmless). create: NOT offered a retry action — retrying blindly could
  // create a duplicate session, so we only surface the error.
  const select = useCallback((id: string) => {
    window.aurict.session.select(id).then((messages) => {
      setActiveId(id);
      onSelect(messages);
      succeed();
    }).catch((reason) => fail(reason, 'Session could not be opened.', () => select(id)));
  }, [onSelect, fail, succeed]);

  const create = useCallback(() => {
    window.aurict.session.create().then((id) => {
      setActiveId(id);
      onNew?.();
      refresh();
      succeed();
    }).catch((reason) => fail(reason, 'A new session could not be created.', null));
  }, [onNew, refresh, fail, succeed]);

  const remove = useCallback((id: string) => {
    window.aurict.session.remove(id).then(({ wasActive }) => {
      if (wasActive) {
        setActiveId(null);
        onNew?.();
      }
      refresh();
      succeed();
    }).catch((reason) => fail(reason, 'Session could not be removed.', () => remove(id)));
  }, [onNew, refresh, fail, succeed]);

  // rename/archive/branch already show their own toast at the call site in
  // MainScreen (with a success message too) — left untouched here.
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

  return { sessions, activeId, error, retryAction, refresh, select, create, remove, rename, archive, branch, search, searchResults };
}