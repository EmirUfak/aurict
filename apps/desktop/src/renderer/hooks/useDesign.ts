import { useCallback, useEffect, useState } from 'react';
import type { DesignSystemInfo, DesignSkillInfo, DesignOutputInfo, DesignArtifactInfo } from '../../shared/ipc-types.js';

export function useDesign() {
  const [systems, setSystems] = useState<DesignSystemInfo[]>([]);
  const [skills, setSkills] = useState<DesignSkillInfo[]>([]);
  const [outputs, setOutputs] = useState<DesignOutputInfo[]>([]);
  const [artifacts, setArtifacts] = useState<DesignArtifactInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshOutputs = useCallback(async () => {
    try {
      const [nextOutputs, nextArtifacts] = await Promise.all([
      window.aurict.design.listOutputs(),
      window.aurict.design.listArtifacts(),
      ]);
      setOutputs(nextOutputs);
      setArtifacts(nextArtifacts);
      setError(null);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      setError(message);
      throw reason;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([
      window.aurict.design.listSystems().then(setSystems),
      window.aurict.design.listSkills().then(setSkills),
      refreshOutputs(),
    ]).catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, [refreshOutputs]);

  const createArtifact = useCallback(async (spec: { brief: string; systemId: string; skillId: string; title?: string }) => {
    const launch = await window.aurict.design.createArtifact(spec);
    await refreshOutputs();
    return launch;
  }, [refreshOutputs]);

  const retryArtifact = useCallback(async (id: string) => {
    const launch = await window.aurict.design.retryArtifact(id);
    await refreshOutputs();
    return launch;
  }, [refreshOutputs]);

  return { systems, skills, outputs, artifacts, loading, error, refreshOutputs, createArtifact, retryArtifact };
}
