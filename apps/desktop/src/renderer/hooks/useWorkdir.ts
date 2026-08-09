import { useCallback, useEffect, useState } from 'react';
import { useAsyncError } from './useAsyncError.js';

export function useWorkdir() {
  const [workdir, setWorkdir] = useState('~');
  const { error, errorSeq, fail, clear } = useAsyncError();

  const load = useCallback(() => {
    void window.aurict.workspace.get().then((workspace) => {
      setWorkdir(workspace.path);
      clear();
    }).catch((reason) => {
      fail(reason, 'Workspace could not be loaded.');
    });
  }, [clear, fail]);

  useEffect(() => {
    load();
    return window.aurict.workspace.onChanged((workspace) => setWorkdir(workspace.path));
  }, [load]);

  const choose = useCallback(async () => {
    try {
      const workspace = await window.aurict.workspace.choose();
      if (workspace) setWorkdir(workspace.path);
      clear();
      return workspace;
    } catch (reason) {
      fail(reason, 'Workspace could not be selected.');
      throw reason;
    }
  }, [clear, fail]);

  return { workdir, error, errorSeq, choose, reload: load };
}
