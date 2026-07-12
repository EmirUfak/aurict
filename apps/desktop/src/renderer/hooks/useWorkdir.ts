import { useCallback, useEffect, useState } from 'react';

export function useWorkdir() {
  const [workdir, setWorkdir] = useState('~');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () => window.aurict.workspace.get().then((workspace) => {
      setWorkdir(workspace.path);
      setError(null);
    });
    void load().catch((reason) => {
      console.error('Failed to load workspace', reason);
      setError(reason instanceof Error ? reason.message : 'Workspace could not be loaded.');
    });
    return window.aurict.workspace.onChanged((workspace) => setWorkdir(workspace.path));
  }, []);

  const choose = useCallback(async () => {
    try {
      const workspace = await window.aurict.workspace.choose();
      if (workspace) setWorkdir(workspace.path);
      setError(null);
      return workspace;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Workspace could not be selected.';
      setError(message);
      throw reason;
    }
  }, []);

  return { workdir, error, choose };
}
