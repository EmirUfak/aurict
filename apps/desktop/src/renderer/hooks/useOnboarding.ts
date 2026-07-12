import { useCallback, useEffect, useState } from 'react';
import type { UserProfile } from '../../shared/ipc-types.js';

export function useOnboarding() {
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setProfile(undefined);
    try {
      setProfile(await window.aurict.onboarding.get());
    } catch (loadError) {
      console.error('Failed to load onboarding profile', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Aurict could not load your saved setup.');
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const complete = useCallback(async (next: UserProfile) => {
    try {
      await window.aurict.onboarding.save(next);
      setError(null);
      setProfile(next);
      return next;
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Aurict could not save your setup.';
      setError(message);
      throw saveError;
    }
  }, []);

  const update = useCallback(async (changes: Partial<UserProfile>) => {
    if (!profile) throw new Error('Cannot update appearance before onboarding is complete');
    const next = { ...profile, ...changes };
    setProfile(next);
    try {
      await window.aurict.onboarding.save(next);
      return next;
    } catch (error) {
      setProfile(profile);
      throw error;
    }
  }, [profile]);

  const reset = useCallback(async () => {
    try {
      await window.aurict.onboarding.reset();
      setError(null);
      setProfile(null);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Aurict could not reset onboarding.');
      throw resetError;
    }
  }, []);

  return { profile, loading: profile === undefined, error, reload: load, complete, update, reset };
}
