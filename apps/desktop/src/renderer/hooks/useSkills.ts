import { useCallback, useEffect, useState } from 'react';
import type { SkillInfo } from '../../shared/ipc-types.js';
import { useAsyncError } from './useAsyncError.js';

export function useSkills() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const { error, errorSeq, fail, clear } = useAsyncError();

  const refresh = useCallback(() => {
    window.aurict.skills.list().then((next) => { setSkills(next); clear(); }).catch((reason) => fail(reason, 'Skills could not be loaded.'));
  }, [fail, clear]);

  useEffect(() => { refresh(); }, [refresh]);

  const install = useCallback((url: string) => {
    return window.aurict.skills.install(url).then((result) => {
      refresh();
      return result;
    });
  }, [refresh]);

  const uninstall = useCallback((id: string) => {
    return window.aurict.skills.uninstall(id).then((ok) => {
      refresh();
      return ok;
    });
  }, [refresh]);

  return { skills, error, errorSeq, refresh, install, uninstall };
}
