import { join } from "path"
import { coreStatePath } from "@aurict/core/storage/paths"
import { loadConfig as loadOmniConfig } from "@aurict/core/config"
import { readJsonFileSync } from "@aurict/core/storage/persisted-json"
import type { AurictConfig } from "./types.js"
import type { OmniConfig } from "@aurict/core/config"

function readJSON(path: string): Partial<AurictConfig> {
  return readJsonFileSync<Partial<AurictConfig>>(path, {
    optional: true,
    description: "Aurict CLI configuration",
    validate: (value): value is Partial<AurictConfig> => Boolean(value && typeof value === "object" && !Array.isArray(value)),
  }) ?? {}
}

// Load priority: global < project < CLI flags (last one wins)
export function loadConfig(workdir: string): AurictConfig {
  const global  = readJSON(coreStatePath("config.json"))
  const project = readJSON(join(workdir, ".aurict", "config.json"))
  const raw = deepMerge(
    deepMerge({}, global as Record<string, unknown>) as Record<string, unknown>,
    project as Record<string, unknown>,
  )
  const omni = loadOmniConfig(workdir)

  return normalizeCliConfig(omni, raw)
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): AurictConfig { // eslint-disable-line @typescript-eslint/no-explicit-any
  const result = { ...target }
  for (const [k, v] of Object.entries(source)) {
    if (v !== null && typeof v === "object" && !Array.isArray(v) && typeof target[k] === "object") {
      result[k] = deepMerge(target[k] as Record<string, unknown>, v as Record<string, unknown>)
    } else if (v !== undefined) {
      result[k] = v
    }
  }
  return result as AurictConfig
}

function normalizeCliConfig(omni: OmniConfig, raw: AurictConfig): AurictConfig {
  const cfg: AurictConfig = { ...omni }
  if (raw.provider !== undefined) cfg.provider = raw.provider
  else if (omni.defaults?.provider !== undefined) cfg.provider = omni.defaults.provider
  if (raw.model !== undefined) cfg.model = raw.model
  else if (omni.defaults?.model !== undefined) cfg.model = omni.defaults.model
  if (raw.system !== undefined) cfg.system = raw.system
  if (raw.undercover !== undefined) cfg.undercover = raw.undercover
  if (raw.stream !== undefined) cfg.stream = raw.stream
  if (raw.server !== undefined) cfg.server = raw.server
  if (raw.skills !== undefined) cfg.skills = raw.skills
  if (raw.multiAgent !== undefined) cfg.multiAgent = raw.multiAgent
  if (raw.agents !== undefined) cfg.agents = { ...(omni.agents ?? {}), ...(raw.agents ?? {}) }
  return cfg
}

export interface CLIFlags {
  provider?: string
  model?:    string
  system?:   string
  stream?:   boolean
  version?:  boolean
  help?:     boolean
  undercover?: boolean
  ipcServer?: boolean
}

export function applyFlags(cfg: AurictConfig, flags: CLIFlags): AurictConfig {
  const result = { ...cfg }
  if (flags.provider !== undefined) (result as Record<string, unknown>)["provider"] = flags.provider
  if (flags.model    !== undefined) (result as Record<string, unknown>)["model"]    = flags.model
  if (flags.system   !== undefined) (result as Record<string, unknown>)["system"]   = flags.system
  if (flags.undercover !== undefined) (result as Record<string, unknown>)["undercover"] = flags.undercover
  if (flags.stream   !== undefined) (result as Record<string, unknown>)["stream"]   = flags.stream
  return result
}
