import { useCallback, useEffect, useState } from 'react';
import type { DesignSystemInfo, DesignSkillInfo, DesignOutputInfo, DesignArtifactInfo } from '../../shared/ipc-types.js';
import { useAsyncError } from './useAsyncError.js';
import { useSidecarGiveUp } from './useSidecarGiveUp.js';

export function useDesign() {
  const [systems, setSystems] = useState<DesignSystemInfo[]>([]);
  const [skills, setSkills] = useState<DesignSkillInfo[]>([]);
  const [outputs, setOutputs] = useState<DesignOutputInfo[]>([]);
  const [artifacts, setArtifacts] = useState<DesignArtifactInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const { error, errorSeq, fail, clear } = useAsyncError();

  const refreshOutputs = useCallback(async () => {
    try {
      const [nextOutputs, nextArtifacts] = await Promise.all([
      window.aurict.design.listOutputs(),
      window.aurict.design.listArtifacts(),
      ]);
      setOutputs(nextOutputs);
      setArtifacts(nextArtifacts);
      clear();
    } catch (reason) {
      fail(reason, String(reason));
      throw reason;
    } finally {
      setLoading(false);
    }
  }, [clear, fail]);

  useEffect(() => {
    // Each source reports its own failure independently — refreshOutputs()
    // already calls fail() (and rethrows only so manual retries can chain
    // .catch()), so wrapping it in the same combined .catch() here would
    // report the exact same failure a second time.
    window.aurict.design.listSystems().then(setSystems).catch((reason) => fail(reason, String(reason)));
    window.aurict.design.listSkills().then(setSkills).catch((reason) => fail(reason, String(reason)));
    void refreshOutputs().catch(() => {undefined});
  }, [refreshOutputs, fail]);
  const retryOnGiveUp = useCallback(() => { void refreshOutputs().catch(() => undefined); }, [refreshOutputs]);
  useSidecarGiveUp(retryOnGiveUp);

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

  return { systems, skills, outputs, artifacts, loading, error, errorSeq, refreshOutputs, createArtifact, retryArtifact };
}
