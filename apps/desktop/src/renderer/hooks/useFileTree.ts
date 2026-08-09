import { useCallback, useEffect, useState } from 'react';
import type { FileTreeEntry } from '../../shared/ipc-types.js';
import { useAsyncError } from './useAsyncError.js';

// Not wired to useSidecarGiveUp: files:tree is a plain main-process
// filesystem read (main.ts:521), not routed through the sidecar — it keeps
// working (or failing for its own, unrelated reasons) regardless of sidecar
// health.
export function useFileTree() {
  const [files, setFiles] = useState<FileTreeEntry[]>([]);
  const { error, errorSeq, fail, clear } = useAsyncError();

  const refresh = useCallback(() => {
    window.aurict.files.tree().then((next) => { setFiles(next); clear(); }).catch((reason) => {
      fail(reason, 'Workspace files could not be loaded.');
    });
  }, [clear, fail]);

  useEffect(() => { refresh(); }, [refresh]);

  return { files, error, errorSeq, refresh };
}