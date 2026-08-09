import { useCallback, useEffect, useState } from 'react';
import type { ProviderInfo, CustomProviderDef } from '../../shared/ipc-types.js';
import { useAsyncError } from './useAsyncError.js';
import { useSidecarGiveUp } from './useSidecarGiveUp.js';

export function useProviders() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const { error, errorSeq, fail, clear } = useAsyncError();

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const next = await window.aurict.provider.list();
      setProviders(next);
      clear();
    } catch (reason) {
      fail(reason, 'Providers could not be loaded.');
      throw reason;
    } finally {
      setLoading(false);
    }
  }, [clear, fail]);

  useEffect(() => { void refresh().catch((reason) => console.error('Initial provider load failed', reason)); }, [refresh]);
  const retryOnGiveUp = useCallback(() => { void refresh().catch(() => undefined); }, [refresh]);
  useSidecarGiveUp(retryOnGiveUp);

  const setKey = useCallback(async (providerId: string, apiKey: string) => {
    await window.aurict.provider.setKey(providerId, apiKey);
    await refresh();
  }, [refresh]);

  const setCustom = useCallback(async (id: string, def: CustomProviderDef) => {
    await window.aurict.provider.setCustom(id, def);
    await refresh();
  }, [refresh]);

  return { providers, loading, error, errorSeq, refresh, setKey, setCustom };
}
