import { useCallback, useEffect, useState } from 'react';
import type { SessionAgentInfo } from '../../shared/ipc-types.js';
import { useAsyncError } from './useAsyncError.js';
import { useSidecarGiveUp } from './useSidecarGiveUp.js';

export function useAgents() {
  const [agents, setAgents] = useState<SessionAgentInfo[]>([]);
  const [agentId, setAgentId] = useState('omni');
  const { error, errorSeq, fail, clear } = useAsyncError();

  const refresh = useCallback(() => {
    window.aurict.agents.list().then((next) => { setAgents(next); clear(); }).catch((reason) => {
      fail(reason, 'Agent modes could not be loaded.');
    });
  }, [clear, fail]);

  useEffect(() => { refresh(); }, [refresh]);
  useSidecarGiveUp(refresh);

  return { agents, agentId, setAgentId, error, errorSeq, refresh };
}
