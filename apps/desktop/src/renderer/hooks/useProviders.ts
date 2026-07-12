import { useCallback, useEffect, useState } from 'react';
import type { ProviderInfo, CustomProviderDef } from '../../shared/ipc-types.js';

export function useProviders() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const next = await window.aurict.provider.list();
      setProviders(next);
      setError(null);
    } catch (reason) {
      console.error('Failed to load providers', reason);
      setError(reason instanceof Error ? reason.message : 'Providers could not be loaded.');
      throw reason;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh().catch((reason) => console.error('Initial provider load failed', reason)); }, [refresh]);

  const setKey = useCallback(async (providerId: string, apiKey: string) => {
    await window.aurict.provider.setKey(providerId, apiKey);
    await refresh();
  }, [refresh]);

  const setCustom = useCallback(async (id: string, def: CustomProviderDef) => {
    await window.aurict.provider.setCustom(id, def);
    await refresh();
  }, [refresh]);

  return { providers, loading, error, refresh, setKey, setCustom };
}
