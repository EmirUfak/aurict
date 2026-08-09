import { app, BrowserWindow, dialog, ipcMain, protocol, screen, shell } from 'electron';
import path from 'node:path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync, unlinkSync, renameSync, mkdirSync, openSync, closeSync, copyFileSync } from 'node:fs';
import started from 'electron-squirrel-startup';
import type {
  SidecarCommand,
  SidecarMessage,
  PermissionDecision,
  CustomProviderDef,
  ChatSubmitPayload,
  Policy,
  DesignOutputInfo,
  MemoryCategory,
  MemoryScope,
  WorkspaceInfo,
  SidecarStatus,
  UserProfile,
  UserType,
  ExperienceLayout,
  ExperienceTheme,
  ColorMode,
  FontPair,
  FinanceCalculationRequest,
  FinanceConversationMessage,
  ArtifactInfo,
  RemoteStatus,
} from './shared/ipc-types.js';
import { createFinanceStore } from './main/finance-store.js';
import { createPendingRequestRegistry, rejectQueue, requestFromSidecar, resolveById, rejectById } from './main/pending-requests.js';
import { wireSidecarChild } from './main/sidecar-process.js';
import { createDesktopStores, isDirectory } from './main/desktop-stores.js';
import { markChangedFiles, readFileTree, resolveWithinRoot } from './main/workspace-files.js';
import { createArtifactStore } from './main/artifact-store.js';

if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let sidecar: ChildProcessWithoutNullStreams | null = null;
let activeWorkdir = process.cwd();
let isQuitting = false;
let runtimeSuspended = false;
let restartAttempts = 0;
let restartTimer: NodeJS.Timeout | null = null;
let runtimeStatus: SidecarStatus = { connected: false, message: 'starting' };
const financeStore = createFinanceStore(() => app.getPath('userData'));
const artifactStore = createArtifactStore(() => app.getPath('userData'), () => activeWorkdir);

const USER_TYPES: UserType[] = ['general', 'developer', 'product', 'designer', 'operator', 'finance'];
const LAYOUTS: ExperienceLayout[] = ['home', 'developer', 'product', 'design', 'operations', 'finance'];
const THEMES: ExperienceTheme[] = ['oxblood', 'paper', 'slate', 'studio', 'forest', 'ledger', 'contrast'];
const COLOR_MODES: ColorMode[] = ['system', 'light', 'dark'];
const FONT_PAIRS: FontPair[] = ['editorial', 'modern', 'technical', 'friendly', 'system'];

function defaultLayout(userType: UserType): ExperienceLayout {
  if (userType === 'general') return 'home';
  if (userType === 'developer') return 'developer';
  if (userType === 'product') return 'product';
  if (userType === 'designer') return 'design';
  if (userType === 'operator') return 'operations';
  return 'finance';
}

function defaultProfile(userType: UserType = 'general'): UserProfile {
  return {
    userType,
    layout: defaultLayout(userType),
    theme: userType === 'finance' ? 'ledger' : userType === 'designer' ? 'studio' : userType === 'general' ? 'paper' : 'oxblood',
    colorMode: 'system',
    fontPair: userType === 'finance' ? 'technical' : userType === 'designer' ? 'editorial' : 'modern',
    preferredProviderId: null,
    preferredModelId: null,
    onboardingVersion: 3,
    completedAt: Date.now(),
  };
}

function normalizeProfile(profile: Partial<UserProfile>): UserProfile | null {
  if (!profile.userType || !USER_TYPES.includes(profile.userType)) return null;
  const fallback = defaultProfile(profile.userType);
  return {
    userType: profile.userType,
    layout: profile.layout && LAYOUTS.includes(profile.layout) ? profile.layout : fallback.layout,
    theme: profile.theme && THEMES.includes(profile.theme) ? profile.theme : fallback.theme,
    colorMode: profile.colorMode && COLOR_MODES.includes(profile.colorMode) ? profile.colorMode : fallback.colorMode,
    fontPair: profile.fontPair && FONT_PAIRS.includes(profile.fontPair) ? profile.fontPair : fallback.fontPair,
    preferredProviderId: typeof profile.preferredProviderId === 'string' ? profile.preferredProviderId : null,
    preferredModelId: typeof profile.preferredModelId === 'string' ? profile.preferredModelId : null,
    onboardingVersion: typeof profile.onboardingVersion === 'number' ? profile.onboardingVersion : 1,
    completedAt: typeof profile.completedAt === 'number' ? profile.completedAt : Date.now(),
  };
}

const desktopStores = createDesktopStores(() => app.getPath('userData'), normalizeProfile);

function currentWorkspace(): WorkspaceInfo {
  const store = desktopStores.readWorkspace();
  return { path: activeWorkdir, recent: (store.recent ?? []).filter(isDirectory) };
}

function notifyWorkspaceChanged(): void {
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) mainWindow.webContents.send('workspace:changed', currentWorkspace());
}

function setRuntimeStatus(status: SidecarStatus): void {
  runtimeStatus = status;
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) mainWindow.webContents.send('runtime:status', status);
}

const pending = createPendingRequestRegistry();

function repoRoot(): string {
  // app.getAppPath() is apps/desktop (the dir containing this package's
  // package.json) in dev mode — anchor from there rather than __dirname,
  // whose depth depends on Vite's build output layout.
  return path.join(app.getAppPath(), '..', '..');
}

function sidecarLaunch(): { command: string; args: string[]; env: NodeJS.ProcessEnv } {
  const sharedEnv = {
    ...process.env,
    AURICT_DESIGN_DATA_DIR: designsDir(),
    AURICT_STATE_DIR: path.join(app.getPath('userData'), 'core'),
    AURICT_REMOTE_STATE_DIR: path.join(app.getPath('userData'), 'remote'),
    AURICT_REMOTE_DEVICE_NAME: `Hoprel by Aurict (${process.platform})`,
    AURICT_REMOTE_PLATFORM: 'desktop',
  };
  if (app.isPackaged) {
    const executable = process.platform === 'win32' ? 'aurict-sidecar.exe' : 'aurict-sidecar';
    return {
      command: path.join(process.resourcesPath, executable),
      args: [],
      env: { ...sharedEnv, AURICT_ASSET_DIR: path.join(process.resourcesPath, 'aurict-data') },
    };
  }
  return {
    command: 'bun',
    args: ['run', path.join(repoRoot(), 'apps', 'desktop', 'src', 'sidecar-entry.ts')],
    env: sharedEnv,
  };
}

function spawnSidecar(): ChildProcessWithoutNullStreams {
  const launch = sidecarLaunch();
  const child = spawn(launch.command, launch.args, {
    cwd: activeWorkdir,
    env: launch.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

    wireSidecarChild(child, () => sidecar, {
    onMessage: (line) => {
      try {
        handleSidecarMessage(JSON.parse(line) as SidecarMessage);
      } catch (err) {
        console.error('[aurict] malformed sidecar message:', line, err);
      }
    },
    onStderr: (chunk) => console.error('[sidecar]', chunk.trimEnd()),
    onSpawn: () => setRuntimeStatus({ connected: true }),
    onError: (error) => {
      sidecar = null;
      console.error('[aurict] sidecar failed to start', error);
      rejectPendingRequests(new Error('Aurict runtime failed to start.'));
      setRuntimeStatus({ connected: false, message: 'sidecar failed to start' });
    },
    onExit: (code, signal) => {
      sidecar = null;
      const message = `sidecar exited (${code ?? signal ?? 'unknown'})`;
      console.error(`[aurict] ${message}`);
      setRuntimeStatus({ connected: false, message });
      rejectPendingRequests(new Error(`Aurict runtime stopped before completing the request (${code ?? signal ?? 'unknown'}).`));
      scheduleSidecarRestart();
    },
  });

  return child;
}

function sendToSidecar(cmd: SidecarCommand): void {
  if (!sidecar || sidecar.stdin.destroyed) {
    throw new Error('Aurict runtime is unavailable. It is restarting; try again shortly.');
  }
  sidecar.stdin.write(JSON.stringify(cmd) + '\n');
}

function startSidecar(): void {
  if (isQuitting || runtimeSuspended || sidecar) return;
  setRuntimeStatus({ connected: false, message: 'starting' });
  sidecar = spawnSidecar();
}

function scheduleSidecarRestart(): void {
  if (isQuitting || runtimeSuspended || restartTimer) return;
  if (restartAttempts >= 3) {
    setRuntimeStatus({ connected: false, message: 'failed to reconnect after 3 attempts — click retry to try again', giveUp: true });
    return;
  }
  const delay = 1_000 * 2 ** restartAttempts;
  restartAttempts += 1;
  setRuntimeStatus({ connected: false, message: `reconnecting in ${Math.ceil(delay / 1_000)}s` });
  restartTimer = setTimeout(() => {
    restartTimer = null;
    startSidecar();
  }, delay);
}

function restartSidecar(): void {
  restartAttempts = 0;
  if (restartTimer) clearTimeout(restartTimer);
  restartTimer = null;
  const previous = sidecar;
  sidecar = null;
  previous?.kill();
  startSidecar();
}

function rejectPendingRequests(error: Error): void {
  rejectQueue(pending.providerList, error); rejectQueue(pending.sessionList, error);
  rejectQueue(pending.sessionSelect, error); rejectQueue(pending.sessionNew, error);
  rejectQueue(pending.sessionDelete, error); rejectQueue(pending.skillsList, error);
  rejectQueue(pending.modelList, error); rejectQueue(pending.modelCurrent, error);
  rejectQueue(pending.agentsList, error); rejectQueue(pending.skillsInstall, error);
  rejectQueue(pending.skillsUninstall, error); rejectQueue(pending.designSystems, error);
  rejectQueue(pending.designSkills, error); rejectQueue(pending.designMatch, error);
  rejectQueue(pending.designBuildPrompt, error); rejectQueue(pending.designArtifactList, error);
  rejectQueue(pending.designArtifactCreate, error); rejectQueue(pending.designArtifactRetry, error);
  rejectQueue(pending.memoryList, error); rejectQueue(pending.memoryAdd, error);
  rejectQueue(pending.memoryRemove, error); rejectQueue(pending.memoryClear, error);
  rejectQueue(pending.financeCalculations, error);
}

// Responses are matched to their request by requestId (resolveById/
// rejectById), not by arrival order — see pending-requests.ts.
function handleSidecarMessage(msg: SidecarMessage): void {
  restartAttempts = 0;
  if (!runtimeStatus.connected) setRuntimeStatus({ connected: true });
  switch (msg.type) {
    case 'chat:event':
      if (msg.event.type === 'artifact:updated') {
        artifactStore.register(msg.event.artifact as ArtifactInfo & { path: string });
      }
      if (msg.event.type === 'finance-research-audit') {
        financeStore.recordConversationAudit(msg.event.researchId, msg.event.audit);
      }
      mainWindow?.webContents.send('chat:event', msg.event);
      return;
    case 'remote:status':
      mainWindow?.webContents.send('remote:status', msg);
      return;
    case 'permission:request':
      if (desktopStores.readPolicy().autoAllowSafe && msg.request.level === 'safe') {
        sendToSidecar({ type: 'permission:respond', id: msg.request.id, decision: 'allow_once' });
        return;
      }
      mainWindow?.webContents.send('permission:request', msg.request);
      return;
    case 'provider:list-result':
      resolveById(pending.providerList, msg.requestId, msg.providers);
      return;
    case 'session:list-result':
      resolveById(pending.sessionList, msg.requestId, msg.sessions);
      return;
    case 'session:select-result':
      resolveById(pending.sessionSelect, msg.requestId, msg.messages);
      return;
    case 'session:new-result':
      resolveById(pending.sessionNew, msg.requestId, msg.id);
      return;
    case 'session:rename-result':
      resolveById(pending.sessionRename, msg.requestId, { id: msg.id, title: msg.title });
      return;
    case 'session:archive-result':
      resolveById(pending.sessionArchive, msg.requestId, { id: msg.id, archived: msg.archived });
      return;
    case 'session:branch-result':
      resolveById(pending.sessionBranch, msg.requestId, { id: msg.id, messages: msg.messages });
      return;
    case 'session:search-result':
      resolveById(pending.sessionSearch, msg.requestId, msg.results);
      return;
    case 'session:delete-result':
      resolveById(pending.sessionDelete, msg.requestId, { wasActive: msg.wasActive });
      return;
    case 'skills:list-result':
      resolveById(pending.skillsList, msg.requestId, msg.skills);
      return;
    case 'model:list-result':
      resolveById(pending.modelList, msg.requestId, msg.models);
      return;
    case 'model:list-error':
      rejectById(pending.modelList, msg.requestId, new Error(msg.message));
      return;
    case 'model:current-result':
      resolveById(pending.modelCurrent, msg.requestId, { providerId: msg.providerId, modelId: msg.modelId });
      return;
    case 'agents:list-result':
      resolveById(pending.agentsList, msg.requestId, msg.agents);
      return;
    case 'skills:install-result':
      resolveById(pending.skillsInstall, msg.requestId, msg.result);
      return;
    case 'skills:uninstall-result':
      resolveById(pending.skillsUninstall, msg.requestId, msg.ok);
      return;
    case 'design:list-systems-result':
      resolveById(pending.designSystems, msg.requestId, msg.systems);
      return;
    case 'design:list-skills-result':
      resolveById(pending.designSkills, msg.requestId, msg.skills);
      return;
    case 'design:match-result':
      resolveById(pending.designMatch, msg.requestId, msg.match);
      return;
    case 'design:build-prompt-result':
      resolveById(pending.designBuildPrompt, msg.requestId, { prompt: msg.prompt, outputDir: msg.outputDir });
      return;
    case 'design:artifact:list-result':
      resolveById(pending.designArtifactList, msg.requestId, msg.artifacts);
      return;
    case 'design:artifact:create-result':
      resolveById(pending.designArtifactCreate, msg.requestId, msg.result);
      return;
    case 'design:artifact:retry-result':
      resolveById(pending.designArtifactRetry, msg.requestId, msg.result);
      return;
    case 'memory:list-result':
      resolveById(pending.memoryList, msg.requestId, msg.memories);
      return;
    case 'memory:add-result':
      resolveById(pending.memoryAdd, msg.requestId, msg.memory);
      return;
    case 'memory:remove-result':
      resolveById(pending.memoryRemove, msg.requestId, msg.ok);
      return;
    case 'memory:clear-result':
      resolveById(pending.memoryClear, msg.requestId, msg.removed);
      return;
    case 'finance:calculate-result': {
      if (msg.error) {
        rejectById(pending.financeCalculations, msg.requestId, new Error(msg.error));
        return;
      }
      if (!msg.result) {
        rejectById(pending.financeCalculations, msg.requestId, new Error('Finance runtime returned no calculation result'));
        return;
      }
      resolveById(pending.financeCalculations, msg.requestId, msg.result);
      return;
    }
  }
}

// Clamp the initial window size to the primary display's available work area
// (excludes the taskbar/dock) instead of a fixed 1360x840. On small/short
// displays the fixed size pushed onboarding content past the visible area
// with no way to reach it — see fix/onboarding-window-sizing.
const createWindow = () => {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const windowWidth = Math.min(1360, screenWidth);
  const windowHeight = Math.min(840, screenHeight);

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    minWidth: Math.min(960, screenWidth),
    minHeight: Math.min(640, screenHeight),
    frame: false,
    backgroundColor: '#0d0a09',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
};

// ── Window control IPC (Faz 1) ──────────────────────────────────────────────
ipcMain.on('window:close', () => mainWindow?.close());
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});

// ── Chat/permission IPC (Faz 2) ──────────────────────────────────────────────
ipcMain.on('chat:submit', (_e, payload: ChatSubmitPayload) => {
  try {
    sendToSidecar({ type: 'chat:submit', payload });
  } catch (error) {
    _e.sender.send('chat:event', {
      type: 'error',
      turnId: payload.turnId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
ipcMain.on('chat:cancel', (_e, turnId: string) => {
  try {
    sendToSidecar({ type: 'chat:cancel', turnId });
  } catch (error) {
    _e.sender.send('chat:event', {
      type: 'error',
      turnId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
ipcMain.on('remote:action', (_event, action: 'login' | 'start' | 'stop' | 'logout' | 'status') => {
  try { sendToSidecar({ type: 'remote:action', action }); }
  catch (error) { _event.sender.send('remote:status', { status: 'error', message: error instanceof Error ? error.message : String(error) } satisfies RemoteStatus); }
});
ipcMain.on('permission:respond', (_e, { id, decision }: { id: string; decision: PermissionDecision }) => {
  try {
    sendToSidecar({ type: 'permission:respond', id, decision });
  } catch (error) {
    console.error('[aurict] permission response could not be delivered', error);
  }
});
ipcMain.handle('provider:list', () => {
  return requestFromSidecar(pending.providerList, 'Provider list', (requestId) => sendToSidecar({ type: 'provider:list', requestId }));
});
ipcMain.handle('provider:set-key', (_e, { providerId, apiKey }: { providerId: string; apiKey: string }) => {
  sendToSidecar({ type: 'provider:set-key', providerId, apiKey });
});
ipcMain.handle('provider:set-custom', (_e, { id, def }: { id: string; def: CustomProviderDef }) => {
  sendToSidecar({ type: 'provider:set-custom', id, def });
});
ipcMain.handle('session:list', () => {
  return requestFromSidecar(pending.sessionList, 'Session list', (requestId) => sendToSidecar({ type: 'session:list', requestId }));
});
ipcMain.handle('session:select', (_e, { id }: { id: string }) => {
  return requestFromSidecar(pending.sessionSelect, 'Session history', (requestId) => sendToSidecar({ type: 'session:select', id, requestId }));
});
ipcMain.handle('session:new', () => {
  return requestFromSidecar(pending.sessionNew, 'New session', (requestId) => sendToSidecar({ type: 'session:new', requestId }));
});
ipcMain.handle('session:rename', (_e, { id, title }: { id: string; title: string }) => {
  return requestFromSidecar(pending.sessionRename, 'Session rename', (requestId) => sendToSidecar({ type: 'session:rename', id, title, requestId }));
});
ipcMain.handle('session:archive', (_e, { id, archived }: { id: string; archived: boolean }) => {
  return requestFromSidecar(pending.sessionArchive, 'Session archive', (requestId) => sendToSidecar({ type: 'session:archive', id, archived, requestId }));
});
ipcMain.handle('session:branch', (_e, id: string) => requestFromSidecar(pending.sessionBranch, 'Session branch', (requestId) => sendToSidecar({ type: 'session:branch', id, requestId })));
ipcMain.handle('session:search', (_e, query: string) => requestFromSidecar(pending.sessionSearch, 'Session search', (requestId) => sendToSidecar({ type: 'session:search', query, requestId })));
ipcMain.handle('session:delete', (_e, id: string) => {
  return requestFromSidecar(pending.sessionDelete, 'Delete session', (requestId) => sendToSidecar({ type: 'session:delete', id, requestId }));
});
ipcMain.handle('skills:list', () => {
  return requestFromSidecar(pending.skillsList, 'Skill list', (requestId) => sendToSidecar({ type: 'skills:list', requestId }));
});
ipcMain.handle('provider:models', (_e, providerId: string) => {
  return requestFromSidecar(pending.modelList, 'Model list', (requestId) => sendToSidecar({ type: 'model:list', providerId, requestId }));
});
ipcMain.handle('provider:current-model', () => {
  return requestFromSidecar(pending.modelCurrent, 'Current model', (requestId) => sendToSidecar({ type: 'model:get-current', requestId }));
});
ipcMain.handle('provider:select-model', (_e, { providerId, modelId }: { providerId: string; modelId: string }) => {
  sendToSidecar({ type: 'model:select', providerId, modelId });
});
ipcMain.handle('agents:list', () => {
  return requestFromSidecar(pending.agentsList, 'Agent list', (requestId) => sendToSidecar({ type: 'agents:list', requestId }));
});
ipcMain.handle('skills:install', (_e, url: string) => {
  return requestFromSidecar(pending.skillsInstall, 'Skill installation', (requestId) => sendToSidecar({ type: 'skills:install', url, requestId }), 30_000);
});
ipcMain.handle('skills:uninstall', (_e, id: string) => {
  return requestFromSidecar(pending.skillsUninstall, 'Skill removal', (requestId) => sendToSidecar({ type: 'skills:uninstall', id, requestId }));
});
ipcMain.handle('design:list-systems', () => {
  return requestFromSidecar(pending.designSystems, 'Design systems', (requestId) => sendToSidecar({ type: 'design:list-systems', requestId }));
});
ipcMain.handle('design:list-skills', () => {
  return requestFromSidecar(pending.designSkills, 'Design skills', (requestId) => sendToSidecar({ type: 'design:list-skills', requestId }));
});
ipcMain.handle('design:match', (_e, brief: string) => {
  return requestFromSidecar(pending.designMatch, 'Design matching', (requestId) => sendToSidecar({ type: 'design:match', brief, requestId }));
});
ipcMain.handle('design:build-prompt', (_e, spec: { brief: string; systemId: string; skillId: string }) => {
  return requestFromSidecar(pending.designBuildPrompt, 'Design prompt', (requestId) => sendToSidecar({ type: 'design:build-prompt', ...spec, requestId }));
});
ipcMain.handle('design:artifact:list', () => {
  return requestFromSidecar(pending.designArtifactList, 'Design artifacts', (requestId) => sendToSidecar({ type: 'design:artifact:list', requestId }));
});
ipcMain.handle('design:artifact:create', (_e, spec: { brief: string; systemId: string; skillId: string; title?: string }) => {
  return requestFromSidecar(pending.designArtifactCreate, 'Design artifact', (requestId) => sendToSidecar({ type: 'design:artifact:create', ...spec, requestId }), 30_000);
});
ipcMain.handle('design:artifact:retry', (_e, id: string) => {
  return requestFromSidecar(pending.designArtifactRetry, 'Design retry', (requestId) => sendToSidecar({ type: 'design:artifact:retry', id, requestId }), 30_000);
});
ipcMain.handle('memory:list', () => {
  return requestFromSidecar(pending.memoryList, 'Memory list', (requestId) => sendToSidecar({ type: 'memory:list', requestId }));
});
ipcMain.handle('memory:add', (_e, data: { content: string; category: MemoryCategory; scope: MemoryScope }) => {
  return requestFromSidecar(pending.memoryAdd, 'Save memory', (requestId) => sendToSidecar({ type: 'memory:add', ...data, requestId }));
});
ipcMain.handle('memory:remove', (_e, id: string) => {
  return requestFromSidecar(pending.memoryRemove, 'Remove memory', (requestId) => sendToSidecar({ type: 'memory:remove', id, requestId }));
});
ipcMain.handle('memory:clear', (_e, scope?: MemoryScope) => {
  return requestFromSidecar(pending.memoryClear, 'Clear memory', (requestId) => sendToSidecar({ type: 'memory:clear', ...(scope ? { scope } : {}), requestId }));
});

// ── Files/workdir IPC (Faz 4) — handled directly in main, no sidecar needed ──
ipcMain.handle('files:tree', async () => {
  const root = activeWorkdir;
  const entries = readFileTree(root);
  return markChangedFiles(root, entries);
});
ipcMain.handle('files:read', (_e, relPath: string) => {
  const root = activeWorkdir;
  return readFileSync(resolveWithinRoot(root, relPath), 'utf8');
});
ipcMain.handle('files:write', (_e, { path: relPath, content }: { path: string; content: string }) => {
  const root = activeWorkdir;
  writeFileSync(resolveWithinRoot(root, relPath), content, 'utf8');
});
ipcMain.handle('files:create', (_e, relPath: string) => {
  try {
    // 'wx' fails if the file already exists, instead of silently truncating it.
    const fd = openSync(resolveWithinRoot(activeWorkdir, relPath), 'wx');
    closeSync(fd);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
});
ipcMain.handle('files:mkdir', (_e, relPath: string) => {
  try {
    mkdirSync(resolveWithinRoot(activeWorkdir, relPath), { recursive: false });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
});
ipcMain.handle('files:delete', (_e, relPath: string) => {
  try {
    unlinkSync(resolveWithinRoot(activeWorkdir, relPath));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
});
ipcMain.handle('files:rename', (_e, { oldPath, newPath }: { oldPath: string; newPath: string }) => {
  try {
    const root = activeWorkdir;
    renameSync(resolveWithinRoot(root, oldPath), resolveWithinRoot(root, newPath));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
});
ipcMain.handle('files:pick-images', async () => {
  const options = {
    title: 'Add design reference images',
    properties: ['openFile', 'multiSelections'] as Array<'openFile' | 'multiSelections'>,
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }],
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);
  return result.filePaths.map((filePath) => ({ path: filePath }));
});
ipcMain.handle('workdir', () => activeWorkdir);
ipcMain.handle('workspace:get', () => currentWorkspace());
ipcMain.handle('workspace:choose', async () => {
  const options = {
    title: 'Choose Aurict workspace',
    defaultPath: activeWorkdir,
    properties: ['openDirectory'] as Array<'openDirectory'>,
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);
  if (result.canceled || !result.filePaths[0]) return null;

  activeWorkdir = path.resolve(result.filePaths[0]);
  desktopStores.writeWorkspace(activeWorkdir);
  notifyWorkspaceChanged();
  restartSidecar();
  return currentWorkspace();
});
ipcMain.handle('runtime:status', () => runtimeStatus);
ipcMain.handle('artifact:list', () => artifactStore.list());
ipcMain.handle('artifact:preview-url', (_event, id: string) => {
  artifactStore.resolve(id);
  return `aurict-artifact://${encodeURIComponent(id)}`;
});
ipcMain.handle('artifact:reveal', (_event, id: string) => {
  const artifact = artifactStore.resolve(id);
  shell.showItemInFolder(artifact.path);
});
ipcMain.handle('artifact:read-text', (_event, id: string) => {
  const artifact = artifactStore.resolve(id);
  if (!['markdown', 'code', 'table', 'document'].includes(artifact.kind)) {
    throw new Error('This artifact cannot be copied as text.');
  }
  return readFileSync(artifact.path, 'utf8');
});
ipcMain.handle('artifact:export', async (_event, id: string) => {
  const artifact = artifactStore.resolve(id);
  const result = mainWindow ? await dialog.showSaveDialog(mainWindow, { defaultPath: artifact.title }) : await dialog.showSaveDialog({ defaultPath: artifact.title });
  if (result.canceled || !result.filePath) return false;
  copyFileSync(artifact.path, result.filePath);
  return true;
});
ipcMain.handle('runtime:retry', () => {
  // Ignore retry while a restart is already underway — otherwise rapid
  // repeated clicks (or an accidental double-click) could kill/respawn
  // the sidecar multiple times in quick succession.
  if (runtimeStatus.message === 'starting') return runtimeStatus;
  restartAttempts = 0;
  restartSidecar();
  return runtimeStatus;
});
ipcMain.handle('onboarding:get', () => desktopStores.readOnboarding());
ipcMain.handle('onboarding:save', (_e, profile: UserProfile) => {
  const normalized = normalizeProfile(profile);
  if (!normalized) throw new Error('Invalid onboarding profile');
  desktopStores.saveOnboarding(normalized);
});
ipcMain.handle('onboarding:reset', () => desktopStores.resetOnboarding());
ipcMain.handle('finance:conversations:list', () => financeStore.listConversations());
ipcMain.handle('finance:conversations:create', () => financeStore.createConversation());
ipcMain.handle('finance:conversations:remove', (_e, id: string) => financeStore.removeConversation(id));
ipcMain.handle('finance:conversations:append-message', (_e, id: string, message: FinanceConversationMessage) => financeStore.appendConversationMessage(id, message));
ipcMain.handle('finance:conversations:complete', (_e, id: string, message: FinanceConversationMessage) => financeStore.completeConversation(id, message));
ipcMain.handle('finance:conversations:fail', (_e, id: string, message: string, cancelled?: boolean) => financeStore.failConversation(id, message, cancelled));
ipcMain.handle('finance:research:list', () => financeStore.listResearch());
ipcMain.handle('finance:research:create', (_e, question: string) => financeStore.createResearch(question));
ipcMain.handle('finance:research:remove', (_e, id: string) => financeStore.removeResearch(id));
ipcMain.handle('finance:calculate', (_e, request: FinanceCalculationRequest) => {
  return requestFromSidecar(
    pending.financeCalculations,
    'Finance calculation',
    (requestId) => sendToSidecar({ type: 'finance:calculate', request, requestId }),
    30_000,
  ).then((result) => financeStore.saveCalculation(result).result);
});
ipcMain.handle('finance:calculations:list', () => financeStore.listCalculations());
ipcMain.handle('finance:calculations:remove', (_e, id: string) => financeStore.removeCalculation(id));

// ── Local policy IPC (Faz 8) ─────────────────────────────────────────────────
ipcMain.handle('policy:get', () => desktopStores.readPolicy());
ipcMain.handle('policy:set', (_e, policy: Policy) => desktopStores.writePolicy(policy));

// ── Design outputs (Faz 10) — pure fs, no sidecar needed ────────────────────
function designsDir(): string {
  return path.join(app.getPath('userData'), 'designs');
}
ipcMain.handle('design:list-outputs', () => {
  const dir = designsDir();
  if (!existsSync(dir)) return [] as DesignOutputInfo[];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(path.join(dir, d.name, 'index.html')))
    .map((d) => ({ slug: d.name, createdAt: statSync(path.join(dir, d.name)).birthtimeMs }))
    .sort((a, b) => b.createdAt - a.createdAt);
});
ipcMain.handle('design:read-output', (_e, slug: string) => {
  return readFileSync(resolveWithinRoot(designsDir(), path.join(slug, 'index.html')), 'utf8');
});

app.on('ready', () => {
  protocol.handle('aurict-artifact', async (request) => {
    const id = decodeURIComponent(new URL(request.url).hostname);
    const artifact = artifactStore.resolve(id);
    return new Response(readFileSync(artifact.path), { headers: { 'content-type': artifact.mimeType ?? 'application/octet-stream' } });
  });
  const stored = desktopStores.readWorkspace().current;
  const fallback = app.isPackaged ? app.getPath('documents') : process.cwd();
  activeWorkdir = isDirectory(stored) ? stored : fallback;
  desktopStores.writeWorkspace(activeWorkdir);
  startSidecar();
  createWindow();
});

app.on('window-all-closed', () => {
  runtimeSuspended = true;
  if (process.platform !== 'darwin') isQuitting = true;
  sidecar?.kill();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  runtimeSuspended = false;
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
  startSidecar();
});

app.on('before-quit', () => {
  isQuitting = true;
  if (restartTimer) clearTimeout(restartTimer);
  sidecar?.kill();
});
