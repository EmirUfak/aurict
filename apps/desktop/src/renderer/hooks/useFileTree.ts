import { useCallback, useEffect, useState } from 'react';
import type { FileTreeEntry } from '../../shared/ipc-types.js';

export function useFileTree() {
  const [files, setFiles] = useState<FileTreeEntry[]>([]);

  const refresh = useCallback(() => {
    window.aurict.files.tree().then(setFiles).catch((error) => console.error('Failed to load workspace files', error));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { files, refresh };
}
