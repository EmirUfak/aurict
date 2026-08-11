import { useCallback, useEffect, useRef, useState } from 'react';
import type { ModelInfo } from '../../shared/ipc-types.js';
import { useAsyncError } from './useAsyncError.js';
import { useSidecarGiveUp } from './useSidecarGiveUp.js';

export function useModelSelection() {
  const [providerId, setProviderId] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const { error, errorSeq, fail, clear } = useAsyncError();
  // The last provider/model combination we know is actually saved
  // server-side. A failed switch rolls providerId/modelId back to this
  // instead of leaving the selects showing a choice that was never applied.
  const lastConfirmed = useRef<{ providerId: string | null; modelId: string | null }>({ providerId: null, modelId: null });

  const loadCurrent = useCallback(() => {
    window.aurict.provider.currentModel().then((current) => {
      lastConfirmed.current = current;
      setProviderId(current.providerId);
      setModelId(current.modelId);
      clear();
    }).catch((reason) => {
      fail(reason, 'Selected model could not be loaded.');
    });
 }, [clear, fail]);
 
  useEffect(() => { loadCurrent(); }, [loadCurrent]);
  useSidecarGiveUp(loadCurrent);

  useEffect(() => {
    if (!providerId) return;
    window.aurict.provider.models(providerId).then((nextModels) => {
      setModels(nextModels);
      clear();
    }).catch((reason) => {
      fail(reason, 'Provider models could not be loaded.');
      setModels([]);
    });
  }, [providerId]);

  const selectProvider = useCallback((nextProviderId: string) => {
    setProviderId(nextProviderId);
    window.aurict.provider.models(nextProviderId).then((list) => {
      const nextModel = list[0]?.id;
      if (!nextModel) throw new Error('This provider has no available models.');
      setModelId(nextModel);
      return window.aurict.provider.selectModel(nextProviderId, nextModel).then(() => {
        lastConfirmed.current = { providerId: nextProviderId, modelId: nextModel };
        clear();
      });
    }).catch((reason) => {
      fail(reason, 'Provider could not be switched.');
      setProviderId(lastConfirmed.current.providerId);
      setModelId(lastConfirmed.current.modelId);
    });
 }, [clear, fail]);

  const selectModel = useCallback((nextModelId: string) => {
    if (!providerId) return;
    setModelId(nextModelId);
    window.aurict.provider.selectModel(providerId, nextModelId).then(() => {
      lastConfirmed.current = { providerId, modelId: nextModelId };
      clear();
    }).catch((reason) => {
      fail(reason, 'Model could not be selected.');
      setModelId(lastConfirmed.current.modelId);
    });
 }, [providerId, clear, fail]);

  return { providerId, modelId, models, error, errorSeq, selectProvider, selectModel };
}
