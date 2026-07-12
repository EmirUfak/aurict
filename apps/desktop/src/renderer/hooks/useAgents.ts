import { useEffect, useState } from 'react';
import type { SessionAgentInfo } from '../../shared/ipc-types.js';

export function useAgents() {
  const [agents, setAgents] = useState<SessionAgentInfo[]>([]);
  const [agentId, setAgentId] = useState('omni');

  useEffect(() => {
    window.aurict.agents.list().then(setAgents).catch((error) => console.error('Failed to load agent modes', error));
  }, []);

  return { agents, agentId, setAgentId };
}
