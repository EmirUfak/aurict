// Shared wire-protocol types between the Electron renderer/main processes and
// the Bun sidecar (packages/cli --ipc-server). Intentionally hand-rolled and
// self-contained — apps/desktop never imports @aurict/core directly (see the
// plan's "Bun sidecar" architecture note), so these mirror only the narrow
// slice of core's shapes that actually crosses the process boundary.

export interface ChatAttachment {
  path: string;
  content?: string;
}
export type ArtifactKind = 'pdf' | 'html' | 'image' | 'markdown' | 'code' | 'table' | 'document' | 'unknown';
export type ArtifactLifecycle = 'generating' | 'ready' | 'failed' | 'unavailable';
export type ArtifactSource = 'workspace' | 'aurict-managed';
export interface ArtifactInfo { id: string; title: string; kind: ArtifactKind; lifecycle: ArtifactLifecycle; source: ArtifactSource; workspace: string; mimeType?: string; createdAt: number; updatedAt: number; sessionId?: string; tool?: string; prompt?: string; error?: string; previousId?: string; }

export interface ChatSubmitPayload {
  text: string;
  attachments?: ChatAttachment[];
  agentId?: string;
  artifactId?: string;
  artifactIntent?: 'create' | 'iterate' | 'promote';
  displayText?: string;
  financeResearchId?: string;
}

export type ChatEvent =
  | { type: 'text-delta'; delta: string; isReasoning?: boolean }
  | { type: 'tool-call'; id: string; tool: string; args: unknown }
  | { type: 'tool-result'; id: string; result: string; durationMs: number }
  | { type: 'chunk'; text: string }
  | { type: 'step-finish' }
  | { type: 'compaction' }
  | { type: 'provider-fallback'; from: string; to: string }
  | { type: 'stream-restart' }
  | { type: 'finance-research-audit'; researchId: string; audit: FinanceResearchAudit }
  | { type: 'artifact:updated'; artifact: ArtifactInfo }
  | { type: 'finish'; text: string; sessionId?: string; finishReason?: string }
  | { type: 'error'; message: string };

export interface PermissionRequestPayload {
  id: string;
  tool: string;
  pattern: string;
  level?: 'safe' | 'warning' | 'danger';
  reason?: string;
  summary?: string;
}

export type PermissionDecision = 'allow' | 'allow_directory' | 'allow_once' | 'allow_partial' | 'deny';

export interface ProviderInfo {
  id: string;
  name: string;
  hasKey: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  maxOutput: number;
  supportsTools: boolean;
  supportsVision: boolean;
}

export interface SessionAgentInfo {
  id: string;
  name: string;
  description: string;
  color: string;
}

export interface CustomProviderDef {
  name: string;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
}

export interface SessionInfo {
  id: string;
  title: string | null;
  createdAt: number;
  updatedAt: number;
  status: string;
  parentId: string | null;
  turnCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheTokens: number;
  accumulatedCostUsd: number;
  provider: string | null;
  lastModel: string | null;
}

export interface SessionMessage {
  role: 'user' | 'assistant';
  content: string;
}
export interface SessionSearchResult { sessionId: string; title: string | null; updatedAt: number; matchCount: number; excerpt: string; }

export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  active: boolean;
  installed: boolean;
}

export interface Policy {
  autoAllowSafe: boolean;
}

export interface WorkspaceInfo {
  path: string;
  recent: string[];
}

export interface SidecarStatus {
  connected: boolean;
  message?: string;
}
export interface RemoteStatus { status: string; message: string; email?: string; sessionId?: string; }

export type UserType = 'general' | 'developer' | 'product' | 'designer' | 'operator' | 'finance';
export type ExperienceLayout = 'home' | 'developer' | 'product' | 'design' | 'operations' | 'finance';
export type ExperienceTheme = 'oxblood' | 'paper' | 'slate' | 'studio' | 'forest' | 'ledger' | 'contrast';
export type ColorMode = 'system' | 'light' | 'dark';
export type FontPair = 'editorial' | 'modern' | 'technical' | 'friendly' | 'system';

export interface UserProfile {
  userType: UserType;
  layout: ExperienceLayout;
  theme: ExperienceTheme;
  colorMode: ColorMode;
  fontPair: FontPair;
  preferredProviderId: string | null;
  preferredModelId: string | null;
  onboardingVersion: number;
  completedAt: number;
}

export interface FinanceResearchEntry {
  id: string;
  question: string;
  createdAt: number;
  dataAsOf?: string;
  status: 'researching' | 'complete' | 'needs-review';
  completedAt?: number;
  audit?: FinanceResearchAudit;
}

export interface FinanceResearchSource {
  title: string;
  url: string;
  publishedAt?: string;
  accessedAt: string;
}

export interface FinanceResearchAudit {
  summary: string;
  dataAsOf?: string;
  sources: FinanceResearchSource[];
  assumptions: string[];
  uncertainties: string[];
  warning?: string;
}

export type FinanceCalculationKind =
  | 'net_present_value'
  | 'internal_rate_of_return'
  | 'extended_internal_rate_of_return'
  | 'compound_annual_growth_rate'
  | 'discounted_cash_flow'
  | 'amortization_schedule'
  | 'fixed_coupon_bond_metrics'
  | 'fixed_coupon_bond_yield_shock';

export interface FinanceCalculationRequest {
  calculation: FinanceCalculationKind;
  input: Record<string, unknown>;
}

export interface FinanceCalculationResult {
  calculation: FinanceCalculationKind;
  formulaVersion: string;
  calculatedAt: string;
  precision: { decimalPlaces: number; rounding: string };
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  assumptions: string[];
  warnings: FinanceWarning[];
}

export interface FinanceWarning {
  code: string;
  message: string;
}

export interface FinanceCalculationEntry {
  id: string;
  savedAt: number;
  result: FinanceCalculationResult;
}

export interface DesignSystemInfo {
  id: string;
  name: string;
  category: string;
  tagline: string;
}

export interface DesignSkillInfo {
  id: string;
  name: string;
  description: string;
  mode: string;
}

export interface DesignMatchResult {
  systemId: string;
  skillId: string;
  systemScore: number;
  skillScore: number;
  alternativeIds: string[];
}

export interface DesignOutputInfo {
  slug: string;
  createdAt: number;
}

export type DesignArtifactStatus = 'draft' | 'generating' | 'ready' | 'failed';

export interface DesignArtifactRevision {
  id: string;
  createdAt: number;
  summary?: string;
  htmlFile: string;
}

export interface DesignArtifactInfo {
  id: string;
  title: string;
  brief: string;
  workspace: string;
  systemId: string;
  skillId: string;
  status: DesignArtifactStatus;
  createdAt: number;
  updatedAt: number;
  error?: string;
  revisions: DesignArtifactRevision[];
}

export interface DesignArtifactLaunch {
  artifact: DesignArtifactInfo;
  prompt: string;
}

export type MemoryCategory = 'preference' | 'project' | 'fact' | 'decision' | 'pattern';
export type MemoryScope = 'global' | 'project';

export interface MemoryInfo {
  id: string;
  content: string;
  category: MemoryCategory;
  scope: MemoryScope;
  project?: string;
  timestamp: number;
  source: 'auto' | 'manual' | 'tool';
  tags?: string[];
}

export interface FileTreeEntry {
  name: string;
  path: string;
  depth: number;
  type: 'dir' | 'file';
  changed: boolean;
}

export interface AurictWindowApi {
  window: {
    close(): void;
    minimize(): void;
    maximize(): void;
  };
  chat: {
    submit(payload: ChatSubmitPayload): void;
    cancel(): void;
    onEvent(cb: (event: ChatEvent) => void): () => void;
  };
  permission: {
    onRequest(cb: (request: PermissionRequestPayload) => void): () => void;
    respond(id: string, decision: PermissionDecision): void;
  };
  provider: {
    list(): Promise<ProviderInfo[]>;
    setKey(providerId: string, apiKey: string): Promise<void>;
    setCustom(id: string, def: CustomProviderDef): Promise<void>;
    models(providerId: string): Promise<ModelInfo[]>;
    currentModel(): Promise<{ providerId: string; modelId: string }>;
    selectModel(providerId: string, modelId: string): Promise<void>;
  };
  agents: {
    list(): Promise<SessionAgentInfo[]>;
  };
  session: {
    list(): Promise<SessionInfo[]>;
    select(id: string): Promise<SessionMessage[]>;
    create(): Promise<string>;
    rename(id: string, title: string): Promise<{ id: string; title: string }>;
    archive(id: string, archived: boolean): Promise<{ id: string; archived: boolean }>;
    branch(id: string): Promise<{ id: string; messages: SessionMessage[] }>;
    search(query: string): Promise<SessionSearchResult[]>;
    remove(id: string): Promise<{ wasActive: boolean }>;
  };
  skills: {
    list(): Promise<SkillInfo[]>;
    install(url: string): Promise<{ id: string; name: string } | { error: string }>;
    uninstall(id: string): Promise<boolean>;
  };
  files: {
    tree(): Promise<FileTreeEntry[]>;
    read(path: string): Promise<string>;
    write(path: string, content: string): Promise<void>;
    create(path: string): Promise<{ ok: boolean; error?: string }>;
    mkdir(path: string): Promise<{ ok: boolean; error?: string }>;
    delete(path: string): Promise<{ ok: boolean; error?: string }>;
    rename(oldPath: string, newPath: string): Promise<{ ok: boolean; error?: string }>;
    pickImages(): Promise<ChatAttachment[]>;
  };
  workdir(): Promise<string>;
  workspace: {
    get(): Promise<WorkspaceInfo>;
    choose(): Promise<WorkspaceInfo | null>;
    onChanged(cb: (workspace: WorkspaceInfo) => void): () => void;
  };
  runtime: {
    getStatus(): Promise<SidecarStatus>;
    retry(): Promise<SidecarStatus>;
    onStatus(cb: (status: SidecarStatus) => void): () => void;
  };
  remote: {
    action(action: 'login' | 'start' | 'stop' | 'logout' | 'status'): void;
    onStatus(cb: (status: RemoteStatus) => void): () => void;
  };
  onboarding: {
    get(): Promise<UserProfile | null>;
    save(profile: UserProfile): Promise<void>;
    reset(): Promise<void>;
  };
  finance: {
    listResearch(): Promise<FinanceResearchEntry[]>;
    createResearch(question: string): Promise<FinanceResearchEntry>;
    removeResearch(id: string): Promise<boolean>;
    calculate(request: FinanceCalculationRequest): Promise<FinanceCalculationResult>;
    listCalculations(): Promise<FinanceCalculationEntry[]>;
    removeCalculation(id: string): Promise<boolean>;
  };
  policy: {
    get(): Promise<Policy>;
    set(policy: Policy): Promise<void>;
  };
  design: {
    listSystems(): Promise<DesignSystemInfo[]>;
    listSkills(): Promise<DesignSkillInfo[]>;
    match(brief: string): Promise<DesignMatchResult>;
    buildPrompt(spec: { brief: string; systemId: string; skillId: string }): Promise<{ prompt: string; outputDir: string }>;
    listOutputs(): Promise<DesignOutputInfo[]>;
    readOutput(slug: string): Promise<string>;
    listArtifacts(): Promise<DesignArtifactInfo[]>;
    createArtifact(spec: { brief: string; systemId: string; skillId: string; title?: string }): Promise<DesignArtifactLaunch>;
    retryArtifact(id: string): Promise<DesignArtifactLaunch>;
  };
  artifact: {
    list(): Promise<ArtifactInfo[]>;
    previewUrl(id: string): Promise<string>;
    reveal(id: string): Promise<void>;
    readText(id: string): Promise<string>;
    export(id: string): Promise<boolean>;
  };
  memory: {
    list(): Promise<MemoryInfo[]>;
    add(data: { content: string; category: MemoryCategory; scope: MemoryScope }): Promise<MemoryInfo>;
    remove(id: string): Promise<boolean>;
    clear(scope?: MemoryScope): Promise<number>;
  };
}

// ── Sidecar stdio protocol (main process <-> Bun sidecar, JSON-lines) ───────
// Every line written to the sidecar's stdin / read from its stdout is exactly
// one JSON object matching one of these shapes.

export type SidecarCommand =
  | { type: 'chat:submit'; payload: ChatSubmitPayload }
  | { type: 'chat:cancel' }
  | { type: 'permission:respond'; id: string; decision: PermissionDecision }
  | { type: 'provider:list' }
  | { type: 'provider:set-key'; providerId: string; apiKey: string }
  | { type: 'provider:set-custom'; id: string; def: CustomProviderDef }
  | { type: 'session:list' }
  | { type: 'session:select'; id: string }
  | { type: 'session:new' }
  | { type: 'session:rename'; id: string; title: string }
  | { type: 'session:archive'; id: string; archived: boolean }
  | { type: 'session:branch'; id: string }
  | { type: 'session:search'; query: string }
  | { type: 'session:delete'; id: string }
  | { type: 'skills:list' }
  | { type: 'skills:install'; url: string }
  | { type: 'skills:uninstall'; id: string }
  | { type: 'model:list'; providerId: string }
  | { type: 'model:get-current' }
  | { type: 'model:select'; providerId: string; modelId: string }
  | { type: 'agents:list' }
  | { type: 'design:list-systems' }
  | { type: 'design:list-skills' }
  | { type: 'design:match'; brief: string }
  | { type: 'design:build-prompt'; brief: string; systemId: string; skillId: string }
  | { type: 'design:artifact:list' }
  | { type: 'design:artifact:create'; brief: string; systemId: string; skillId: string; title?: string }
  | { type: 'design:artifact:retry'; id: string }
  | { type: 'memory:list' }
  | { type: 'memory:add'; content: string; category: MemoryCategory; scope: MemoryScope }
  | { type: 'memory:remove'; id: string }
  | { type: 'memory:clear'; scope?: MemoryScope }
  | { type: 'finance:calculate'; request: FinanceCalculationRequest }
  | { type: 'remote:action'; action: 'login' | 'start' | 'stop' | 'logout' | 'status' };

export type SidecarMessage =
  | { type: 'chat:event'; event: ChatEvent }
  | { type: 'permission:request'; request: PermissionRequestPayload }
  | { type: 'provider:list-result'; providers: ProviderInfo[] }
  | { type: 'session:list-result'; sessions: SessionInfo[] }
  | { type: 'session:select-result'; messages: SessionMessage[] }
  | { type: 'session:new-result'; id: string }
  | { type: 'session:rename-result'; id: string; title: string }
  | { type: 'session:archive-result'; id: string; archived: boolean }
  | { type: 'session:branch-result'; id: string; messages: SessionMessage[] }
  | { type: 'session:search-result'; results: SessionSearchResult[] }
  | { type: 'session:delete-result'; id: string; wasActive: boolean }
  | { type: 'skills:list-result'; skills: SkillInfo[] }
  | { type: 'skills:install-result'; result: { id: string; name: string } | { error: string } }
  | { type: 'skills:uninstall-result'; ok: boolean }
  | { type: 'model:list-result'; models: ModelInfo[] }
  | { type: 'model:current-result'; providerId: string; modelId: string }
  | { type: 'agents:list-result'; agents: SessionAgentInfo[] }
  | { type: 'design:list-systems-result'; systems: DesignSystemInfo[] }
  | { type: 'design:list-skills-result'; skills: DesignSkillInfo[] }
  | { type: 'design:match-result'; match: DesignMatchResult }
  | { type: 'design:build-prompt-result'; prompt: string; outputDir: string }
  | { type: 'design:artifact:list-result'; artifacts: DesignArtifactInfo[] }
  | { type: 'design:artifact:create-result'; result: DesignArtifactLaunch }
  | { type: 'design:artifact:retry-result'; result: DesignArtifactLaunch }
  | { type: 'memory:list-result'; memories: MemoryInfo[] }
  | { type: 'memory:add-result'; memory: MemoryInfo }
  | { type: 'memory:remove-result'; ok: boolean }
  | { type: 'memory:clear-result'; removed: number }
  | { type: 'finance:calculate-result'; result?: FinanceCalculationResult; error?: string }
  | { type: 'remote:status'; status: string; message: string; email?: string; sessionId?: string };
