import { useCallback, useEffect, useState } from 'react';
import type { ArtifactInfo } from '../../shared/ipc-types.js';
import { useAsyncError } from './useAsyncError.js';

// Not wired to useSidecarGiveUp: artifact:list reads artifactStore's
// in-memory list directly in the main process (main.ts:600), not routed
// through the sidecar.
export function useArtifacts() {
  const [artifacts, setArtifacts] = useState<ArtifactInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const { error, errorSeq, fail, clear } = useAsyncError();
  const refresh = useCallback(async () => {
    try {
      setArtifacts(await window.aurict.artifact.list());
      clear();
    } catch (reason) {
      fail(reason, 'Artifacts could not be loaded.');
    }
  }, [clear, fail]);
  useEffect(() => { void refresh(); return window.aurict.chat.onEvent((event) => {
    if (event.type !== 'artifact:updated') return;
    setArtifacts((current) => [event.artifact, ...current.filter((item) => item.id !== event.artifact.id)]);
    setActiveId(event.artifact.id); setOpen(true);
  }); }, [refresh]);
  const select = useCallback((id: string) => { setActiveId(id); setOpen(true); }, []);
  return { artifacts, activeId, open, setOpen, select, refresh, error, errorSeq };
}
