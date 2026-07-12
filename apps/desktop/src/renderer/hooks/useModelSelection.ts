import { useCallback, useEffect, useState } from 'react';
import type { ModelInfo } from '../../shared/ipc-types.js';

export function useModelSelection() {
  const [providerId, setProviderId] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.aurict.provider.currentModel().then((current) => {
      setProviderId(current.providerId);
      setModelId(current.modelId);
    }).catch((reason) => {
      console.error('Failed to load selected model', reason);
      setError(reason instanceof Error ? reason.message : 'Selected model could not be loaded.');
    });
  }, []);

  useEffect(() => {
    if (!providerId) return;
    window.aurict.provider.models(providerId).then((nextModels) => {
      setModels(nextModels);
      setError(null);
    }).catch((reason) => {
      console.error('Failed to load provider models', reason);
      setError(reason instanceof Error ? reason.message : 'Provider models could not be loaded.');
      setModels([]);
    });
  }, [providerId]);

  const selectProvider = useCallback((nextProviderId: string) => {
    setProviderId(nextProviderId);
    window.aurict.provider.models(nextProviderId).then((list) => {
      const nextModel = list[0]?.id;
      if (nextModel) {
        setModelId(nextModel);
        window.aurict.provider.selectModel(nextProviderId, nextModel).then(() => setError(null)).catch((reason) => {
          console.error('Failed to select provider model', reason);
          setError(reason instanceof Error ? reason.message : 'Provider model could not be selected.');
        });
      }
    }).catch((reason) => {
      console.error('Failed to switch provider', reason);
      setError(reason instanceof Error ? reason.message : 'Provider could not be switched.');
    });
  }, []);

  const selectModel = useCallback((nextModelId: string) => {
    setModelId(nextModelId);
    if (providerId) window.aurict.provider.selectModel(providerId, nextModelId).then(() => setError(null)).catch((reason) => {
      console.error('Failed to select model', reason);
      setError(reason instanceof Error ? reason.message : 'Model could not be selected.');
    });
  }, [providerId]);

  return { providerId, modelId, models, error, selectProvider, selectModel };
}
