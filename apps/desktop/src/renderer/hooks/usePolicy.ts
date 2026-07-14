import { useCallback, useEffect, useState } from 'react';
import type { Policy } from '../../shared/ipc-types.js';

export function usePolicy() {
  const [policy, setPolicyState] = useState<Policy>({ autoAllowSafe: true });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.aurict.policy.get().then((next) => {
      setPolicyState(next);
      setError(null);
    }).catch((reason) => {
      console.error('Failed to load permission policy', reason);
      setError(reason instanceof Error ? reason.message : 'Permission policy could not be loaded.');
    });
  }, []);

  const setAutoAllowSafe = useCallback(async (value: boolean) => {
    const next = { ...policy, autoAllowSafe: value };
    setPolicyState(next);
    setError(null);
    try {
      await window.aurict.policy.set(next);
    } catch (reason) {
      console.error('Failed to save permission policy', reason);
      setPolicyState(policy);
      setError(reason instanceof Error ? reason.message : 'Permission policy could not be saved.');
      throw reason;
    }
  }, [policy]);

  return { policy, error, setAutoAllowSafe };
}
