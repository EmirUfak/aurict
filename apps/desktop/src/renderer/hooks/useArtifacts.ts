import { useCallback, useEffect, useState } from 'react';
import type { ArtifactInfo } from '../../shared/ipc-types.js';

export function useArtifacts() {
  const [artifacts, setArtifacts] = useState<ArtifactInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const refresh = useCallback(async () => setArtifacts(await window.aurict.artifact.list()), []);
  useEffect(() => { void refresh().catch(console.error); return window.aurict.chat.onEvent((event) => {
    if (event.type !== 'artifact:updated') return;
    setArtifacts((current) => [event.artifact, ...current.filter((item) => item.id !== event.artifact.id)]);
    setActiveId(event.artifact.id); setOpen(true);
  }); }, [refresh]);
  const select = useCallback((id: string) => { setActiveId(id); setOpen(true); }, []);
  return { artifacts, activeId, open, setOpen, select, refresh };
}
