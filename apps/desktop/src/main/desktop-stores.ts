import path from 'node:path';
import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import type { Policy, UserProfile } from '../shared/ipc-types.js';

export interface WorkspaceStore {
  current?: string;
  recent?: string[];
}

const DEFAULT_POLICY: Policy = { autoAllowSafe: false };

export function isDirectory(dir: string | undefined): dir is string {
  if (!dir) return false;
  try {
    return statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

export function createDesktopStores(
  userDataPath: () => string,
  normalizeProfile: (profile: Partial<UserProfile>) => UserProfile | null,
) {
  const workspacePath = () => path.join(userDataPath(), 'workspace.json');
  const onboardingPath = () => path.join(userDataPath(), 'onboarding.json');
  const policyPath = () => path.join(userDataPath(), 'policy.json');

  const backupCorrupt = (filePath: string, label: string, error: unknown): void => {
    const backup = `${filePath}.corrupt-${Date.now()}`;
    try {
      if (existsSync(filePath)) renameSync(filePath, backup);
      console.error(`[aurict] ${label} was corrupt and moved to ${backup}`, error);
    } catch (backupError) {
      console.error(`[aurict] ${label} was corrupt and could not be backed up`, error, backupError);
    }
  };

  const writeAtomically = (filePath: string, value: unknown): void => {
    const temporaryPath = `${filePath}.${process.pid}.tmp`;
    writeFileSync(temporaryPath, JSON.stringify(value, null, 2), 'utf8');
    renameSync(temporaryPath, filePath);
  };

  const readWorkspace = (): WorkspaceStore => {
    try {
      if (!existsSync(workspacePath())) return {};
      return JSON.parse(readFileSync(workspacePath(), 'utf8')) as WorkspaceStore;
    } catch (error) {
      backupCorrupt(workspacePath(), 'workspace store', error);
      return {};
    }
  };

  const writeWorkspace = (current: string): WorkspaceStore => {
    const previous = readWorkspace();
    const recent = [current, ...(previous.recent ?? []).filter((dir) => dir !== current && isDirectory(dir))].slice(0, 8);
    const next = { current, recent };
    writeAtomically(workspacePath(), next);
    return next;
  };

  const readOnboarding = (): UserProfile | null => {
    try {
      if (!existsSync(onboardingPath())) return null;
      return normalizeProfile(JSON.parse(readFileSync(onboardingPath(), 'utf8')) as Partial<UserProfile>);
    } catch (error) {
      backupCorrupt(onboardingPath(), 'onboarding profile', error);
      throw new Error('Your saved setup could not be read. You can safely start onboarding again.');
    }
  };

  const saveOnboarding = (profile: UserProfile): void => writeAtomically(onboardingPath(), profile);
  const resetOnboarding = (): void => {
    if (existsSync(onboardingPath())) {
      try { renameSync(onboardingPath(), `${onboardingPath()}.reset-${Date.now()}`); }
      catch (error) { throw new Error(`Could not reset onboarding: ${error instanceof Error ? error.message : String(error)}`); }
    }
  };

  const readPolicy = (): Policy => {
    try {
      if (!existsSync(policyPath())) return DEFAULT_POLICY;
      return { ...DEFAULT_POLICY, ...JSON.parse(readFileSync(policyPath(), 'utf8')) };
    } catch (error) {
      backupCorrupt(policyPath(), 'permission policy', error);
      return DEFAULT_POLICY;
    }
  };

  return { readWorkspace, writeWorkspace, readOnboarding, saveOnboarding, resetOnboarding, readPolicy, writePolicy: (policy: Policy) => writeAtomically(policyPath(), policy) };
}
