import { useCallback, useEffect, useState } from 'react';
import type { MemoryInfo, MemoryCategory, MemoryScope } from '../../shared/ipc-types.js';
import { useAsyncError } from './useAsyncError.js';

export function useMemory() {
  const [memories, setMemories] = useState<MemoryInfo[]>([]);
  const { error, errorSeq, fail: reportFailure, clear: clearError } = useAsyncError();
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null);

  const fail = useCallback((reason: unknown, fallback: string, retry: (() => void) | null) => {
    reportFailure(reason, fallback);
    setRetryAction(() => retry);
  }, [reportFailure]);
  const succeed = useCallback(() => { clearError(); setRetryAction(null); }, [clearError]);

  const refresh = useCallback(() => {
    window.aurict.memory.list().then((next) => { setMemories(next); succeed(); }).catch((reason) => fail(reason, 'Memories could not be loaded.', refresh));
  }, [fail, succeed]);

  useEffect(() => { refresh(); }, [refresh]);

  // add: no retry offered — retrying blindly could add a duplicate memory
  // (same reasoning as session create in useSessions).
  const add = useCallback((content: string, category: MemoryCategory, scope: MemoryScope) => {
    window.aurict.memory.add({ content, category, scope }).then(() => { refresh(); succeed(); }).catch((reason) => fail(reason, 'Memory could not be added.', null));
  }, [refresh, fail, succeed]);

  const remove = useCallback((id: string) => {
    window.aurict.memory.remove(id).then(() => { refresh(); succeed(); }).catch((reason) => fail(reason, 'Memory could not be removed.', () => remove(id)));
  }, [refresh, fail, succeed]);

  const clear = useCallback((scope?: MemoryScope) => {
    window.aurict.memory.clear(scope).then(() => { refresh(); succeed(); }).catch((reason) => fail(reason, 'Memories could not be cleared.', () => clear(scope)));
  }, [refresh, fail, succeed]);

  return { memories, error, errorSeq, retryAction, refresh, add, remove, clear };
}
