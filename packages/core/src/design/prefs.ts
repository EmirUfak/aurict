import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { coreStateDir, coreStatePath } from "../storage/paths.js"

function prefsPath(): string {
  return coreStatePath('design-prefs.json')
}

export interface DesignPrefs {
  lastSystemId?:    string
  lastSkillId?:     string
  favoriteSystemIds: string[]
  favoriteSkillIds:  string[]
  recentSystemIds:   string[]   // last 5 used, most recent first
}

function defaults(): DesignPrefs {
  return { favoriteSystemIds: [], favoriteSkillIds: [], recentSystemIds: [] }
}

export function loadDesignPrefs(): DesignPrefs {
  const path = prefsPath()
  if (!existsSync(path)) return defaults()
  try {
    return { ...defaults(), ...(JSON.parse(readFileSync(path, "utf8")) as Partial<DesignPrefs>) }
  } catch (error) {
    throw new Error(`Failed to read design preferences at ${path}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export function saveDesignPrefs(prefs: DesignPrefs): void {
  const path = prefsPath()
  mkdirSync(coreStateDir(), { recursive: true })
  writeFileSync(path, JSON.stringify(prefs, null, 2), "utf8")
}

export function recordSystemUsed(systemId: string): void {
  const prefs = loadDesignPrefs()
  prefs.lastSystemId   = systemId
  prefs.recentSystemIds = [systemId, ...prefs.recentSystemIds.filter(id => id !== systemId)].slice(0, 5)
  saveDesignPrefs(prefs)
}

export function recordSkillUsed(skillId: string): void {
  const prefs = loadDesignPrefs()
  prefs.lastSkillId = skillId
  saveDesignPrefs(prefs)
}
