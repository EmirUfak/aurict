import React from 'react';
import { useModelSelection } from '../hooks/useModelSelection.js';
import { useProviders } from '../hooks/useProviders.js';
import { useErrorToast } from '../hooks/useErrorToast.js';
import type { ToastItem } from './ToastRegion.js';

interface Props {
  showToast?: (message: string, tone: ToastItem['tone'], action?: ToastItem['action']) => void;
}

export function ModelSelector({ showToast }: Props = {}) {
  const providers = useProviders(); const selection = useModelSelection();
  const error = providers.error ?? selection.error;
  useErrorToast(providers.error, providers.errorSeq, showToast ? providers.refresh : null, showToast ?? (() => {undefined}));
  return <div><div className="aur-model-selector"><select aria-label="Provider" disabled={providers.loading || providers.providers.length === 0} value={selection.providerId ?? ''} onChange={(event) => selection.selectProvider(event.target.value)}>{providers.providers.length === 0 && <option value="">{providers.loading ? 'Loading providers…' : 'No provider configured'}</option>}{providers.providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select><select aria-label="Model" disabled={!selection.providerId || selection.models.length === 0} value={selection.modelId ?? ''} onChange={(event) => selection.selectModel(event.target.value)}>{selection.models.length === 0 && <option value="">No model available</option>}{selection.models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}</select></div>{error && <div className="aur-inline-error" role="alert">{error}</div>}</div>;
}
