import { useCallback, useEffect, useState } from 'react';
import type { MemoryInfo, MemoryCategory, MemoryScope } from '../../shared/ipc-types.js';

export function useMemory() {
  const [memories, setMemories] = useState<MemoryInfo[]>([]);

  const refresh = useCallback(() => {
    window.aurict.memory.list().then(setMemories).catch((error) => console.error('Failed to load memories', error));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const add = useCallback((content: string, category: MemoryCategory, scope: MemoryScope) => {
    window.aurict.memory.add({ content, category, scope }).then(() => refresh()).catch((error) => console.error('Failed to add memory', error));
  }, [refresh]);

  const remove = useCallback((id: string) => {
    window.aurict.memory.remove(id).then(() => refresh()).catch((error) => console.error('Failed to remove memory', error));
  }, [refresh]);

  const clear = useCallback((scope?: MemoryScope) => {
    window.aurict.memory.clear(scope).then(() => refresh()).catch((error) => console.error('Failed to clear memories', error));
  }, [refresh]);

  return { memories, refresh, add, remove, clear };
}
