import { useCallback, useEffect, useState } from 'react';
import type { FileTreeEntry } from '../../shared/ipc-types.js';

export function useFileTree() {
  const [files, setFiles] = useState<FileTreeEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    window.aurict.files.tree().then((next) => { setFiles(next); setError(null); }).catch((reason) => {
      console.error('Failed to load workspace files', reason);
      setError(reason instanceof Error ? reason.message : 'Workspace files could not be loaded.');
    });
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { files, error, refresh };
}