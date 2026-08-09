import React, { useCallback, useEffect, useState } from 'react';
import type { ModelInfo, ProviderInfo } from '../../shared/ipc-types.js';
import { useSidecarGiveUp } from '../hooks/useSidecarGiveUp.js';

export interface ProviderModelPreference {
  providerId: string | null;
  modelId: string | null;
}

interface Props {
  value: ProviderModelPreference;
  onChange: (value: ProviderModelPreference) => void;
}

export function OnboardingModelStep({ value, onChange }: Props) {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providersFailed, setProvidersFailed] = useState(false);
  const [modelsFailed, setModelsFailed] = useState(false);

  const loadProviders = useCallback(() => {
    setLoadingProviders(true);
    setProvidersFailed(false);
    setError(null);
    void window.aurict.provider.list().then((nextProviders) => {
      setProviders(nextProviders);
      setLoadingProviders(false);
    }).catch((reason) => {
      console.error('Failed to load onboarding providers', reason);
      setError(reason instanceof Error ? reason.message : 'Providers could not be loaded.');
      setProvidersFailed(true);
      setLoadingProviders(false);
    });
  }, []);

  useEffect(() => { loadProviders(); }, [loadProviders]);

  const loadModels = useCallback((providerId: string) => {
    setLoadingModels(true);
    setModelsFailed(false);
    setError(null);
    void window.aurict.provider.models(providerId).then((nextModels) => {
      setModels(nextModels);
      setLoadingModels(false);
    }).catch((reason) => {
      console.error('Failed to load onboarding provider models', reason);
      setError(reason instanceof Error ? reason.message : 'Provider models could not be loaded.');
      setModelsFailed(true);
      setModels([]);
      setLoadingModels(false);
    });
  }, []);

  useEffect(() => {
    if (!value.providerId) {
      setModels([]);
      return;
    }
    loadModels(value.providerId);
    // Re-running only when the provider changes is intentional — loadModels
    // itself is stable (useCallback with no deps) and re-triggering it here
    // would refetch on every render.
  }, [value.providerId]);

  // This step manages its own local provider/model state instead of the
  // useProviders/useModelSelection hooks, so it needs its own recovery
  // wiring too. Without this, a sidecar outage that starts *after* the
  // initial (successful) load on mount never re-runs loadProviders/
  // loadModels — providersFailed/modelsFailed simply never flip true, so
  // the Retry button never appears until the step is unmounted and
  // remounted (e.g. Back then forward again), which is what forces a fresh
  // load attempt that then correctly fails and shows Retry.
  const recoverFromOutage = useCallback(() => {
    loadProviders();
    if (value.providerId) loadModels(value.providerId);
  }, [loadProviders, loadModels, value.providerId]);
  useSidecarGiveUp(recoverFromOutage);

  async function selectProvider(providerId: string) {
    try {
      setError(null);
      setLoadingModels(true);
      const nextModels = await window.aurict.provider.models(providerId);
      setModels(nextModels);
      const modelId = nextModels[0]?.id;
      if (!modelId) throw new Error('This provider has no available models.');
      await window.aurict.provider.selectModel(providerId, modelId);
      onChange({ providerId, modelId });
    } catch (reason) {
      console.error('Failed to select onboarding provider', reason);
      setError(reason instanceof Error ? reason.message : 'Provider could not be selected.');
    } finally {
      setLoadingModels(false);
    }
  }

  async function selectModel(modelId: string) {
    if (!value.providerId) return;
    try {
      setError(null);
      await window.aurict.provider.selectModel(value.providerId, modelId);
      onChange({ providerId: value.providerId, modelId });
    } catch (reason) {
      console.error('Failed to select onboarding model', reason);
      setError(reason instanceof Error ? reason.message : 'Model could not be selected.');
    }
  }

  return <section style={{ padding: 18, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 10 }}>
    <p style={eyebrowStyle}>AI defaults</p>
    <h2 style={titleStyle}>Choose your provider and default model</h2>
    <p style={detailStyle}>Changing the provider fetches its available models automatically. You can change both later in Settings.</p>
    <div className="aur-onboarding-model-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 18 }}>
      <label style={labelStyle}>Provider
        <select aria-label="Provider" disabled={loadingProviders || providers.length === 0} onChange={(event) => { void selectProvider(event.target.value); }} style={selectStyle} value={value.providerId ?? ''}>
          <option value="">{loadingProviders ? 'Loading providers…' : 'Choose a provider'}</option>
          {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}{provider.hasKey ? '' : ' · key needed'}</option>)}
        </select>
      </label>
      <label style={labelStyle}>Default model
        <select aria-label="Default model" disabled={!value.providerId || loadingModels || models.length === 0} onChange={(event) => { void selectModel(event.target.value); }} style={selectStyle} value={value.modelId ?? ''}>
          <option value="">{loadingModels ? 'Loading models…' : 'Choose a model'}</option>
          {models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
        </select>
      </label>
    </div>
    {error && (
      <div className="aur-inline-error" role="alert" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span>{error}</span>
        {/* There's no Titlebar during onboarding (it only mounts after
          onboarding completes in App.tsx), so this is the only recovery
          path if the sidecar itself never came up — retry it here too,
          the same action the Titlebar's own retry button performs,
          alongside re-asking for the list that actually failed. */}
        {providersFailed && <button type="button" onClick={() => { void window.aurict.runtime.retry(); loadProviders(); }}>Retry</button>}
        {modelsFailed && value.providerId && <button type="button" onClick={() => { void window.aurict.runtime.retry(); loadModels(value.providerId as string); }}>Retry</button>}
      </div>
    )}
  </section>;
}

const eyebrowStyle: React.CSSProperties = { margin: 0, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: '.06em', textTransform: 'uppercase' };
const titleStyle: React.CSSProperties = { margin: '8px 0 0', fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--text)' };
const detailStyle: React.CSSProperties = { margin: '8px 0 0', fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.55, color: 'var(--text-muted)' };
const labelStyle: React.CSSProperties = { display: 'grid', gap: 7, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-subtle)' };
const selectStyle: React.CSSProperties = { width: '100%', minWidth: 0, padding: '10px 11px', color: 'var(--text)', background: 'var(--bg-deep)', border: '1px solid var(--border-strong)', borderRadius: 7, fontFamily: 'var(--font-mono)', fontSize: 12 };