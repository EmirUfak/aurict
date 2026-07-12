import React, { useEffect, useRef, useState } from 'react';
import { Titlebar, type Screen } from './components/Titlebar.js';
import { ApprovalModal } from './components/ApprovalModal.js';
import { MainScreen } from './screens/MainScreen.js';
import { ExtensionsScreen } from './screens/ExtensionsScreen.js';
import { DesignScreen } from './screens/DesignScreen.js';
import { MemoryScreen } from './screens/MemoryScreen.js';
import { SettingsScreen } from './screens/SettingsScreen.js';
import { FinanceScreen } from './screens/FinanceScreen.js';
import { HomeScreen } from './screens/HomeScreen.js';
import { RoleWorkspaceScreen } from './screens/RoleWorkspaceScreen.js';
import { usePermission } from './hooks/usePermission.js';
import { useWorkdir } from './hooks/useWorkdir.js';
import { useChat } from './hooks/useChat.js';
import { useSessions } from './hooks/useSessions.js';
import { useOnboarding } from './hooks/useOnboarding.js';
import { OnboardingScreen } from './screens/OnboardingScreen.js';
import type { ExperienceLayout } from '../shared/ipc-types.js';
import { applyAppearance } from './experience/appearance.js';
import { AppStateScreen } from './components/AppStateScreen.js';
import { ArtifactRail } from './components/ArtifactRail.js';
import { useArtifacts } from './hooks/useArtifacts.js';

function startScreen(layout: ExperienceLayout): Screen {
  if (layout === 'design') return 'design';
  if (layout === 'finance') return 'finance';
  return 'main';
}

export function App() {
  const [screen, setScreen] = useState<Screen>('main');
  const permission = usePermission();
  const workdir = useWorkdir();
  // Lifted above MainScreen/DesignScreen so a design brief submitted from the
  // Design tab shows up in the same transcript/session when we switch back to Main.
  const chat = useChat();
  const sessions = useSessions(chat.restoreHistory, chat.resetForNewSession);
  const onboarding = useOnboarding();
  const artifacts = useArtifacts();
  const hasAppliedInitialScreen = useRef(false);

  useEffect(() => {
    if (!onboarding.profile) {
      hasAppliedInitialScreen.current = false;
      return;
    }
    if (!hasAppliedInitialScreen.current) {
      setScreen(startScreen(onboarding.profile.layout));
      hasAppliedInitialScreen.current = true;
    }
  }, [onboarding.profile]);

  useEffect(() => {
    const profile = onboarding.profile;
    if (!profile) return;
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      applyAppearance(root, profile, media.matches);
    };
    apply();
    if (profile.colorMode !== 'system') return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [onboarding.profile]);

  if (onboarding.loading) {
    return <AppStateScreen title="Preparing your workspace" detail="Loading your local Aurict setup…" busy />;
  }

  if (onboarding.error) {
    return <AppStateScreen
      title="Your setup needs attention"
      detail={onboarding.error}
      action={{ label: 'Try again', onClick: () => { void onboarding.reload(); } }}
      secondaryAction={{ label: 'Start onboarding again', onClick: () => { void onboarding.reset(); } }}
    />;
  }

  if (!onboarding.profile) {
    return <OnboardingScreen onComplete={async (profile) => { await onboarding.complete(profile); setScreen(startScreen(profile.layout)); }} />;
  }

  return (
    <div className="aur-app-shell">
      <Titlebar screen={screen} onNavigate={setScreen} workdir={workdir.workdir} onChooseWorkdir={workdir.choose} userType={onboarding.profile.userType} layout={onboarding.profile.layout} />

      {screen === 'main' && (onboarding.profile.layout === 'developer'
        ? <MainScreen permission={permission} chat={chat} sessions={sessions} userType={onboarding.profile.userType} />
        : onboarding.profile.layout === 'product'
          ? <RoleWorkspaceScreen role="product" chat={chat} onOpenDesign={() => setScreen('design')} />
          : onboarding.profile.layout === 'operations'
            ? <RoleWorkspaceScreen role="operator" chat={chat} onOpenDesign={() => setScreen('design')} />
            : <HomeScreen chat={chat} userType={onboarding.profile.userType} />)}
      {screen === 'extensions' && <ExtensionsScreen />}
      {screen === 'design' && <DesignScreen chat={chat} onLaunched={() => setScreen('main')} userType={onboarding.profile.userType} />}
      {screen === 'finance' && <FinanceScreen chat={chat} onLaunched={() => setScreen('main')} />}
      {screen === 'memory' && <MemoryScreen />}
      {screen === 'settings' && onboarding.profile && <SettingsScreen profile={onboarding.profile} onUpdateProfile={onboarding.update} onResetOnboarding={onboarding.reset} workspace={workdir.workdir} workspaceError={workdir.error} onChooseWorkspace={workdir.choose} />}

      {permission.current && (
        <ApprovalModal request={permission.current} onRespond={permission.respond} />
      )}
      <ArtifactRail artifacts={artifacts.artifacts} activeId={artifacts.activeId} open={artifacts.open} onClose={() => artifacts.setOpen(false)} onSelect={artifacts.select} />
    </div>
  );
}
