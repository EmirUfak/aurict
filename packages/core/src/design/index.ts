export { DesignLoader } from "./loader.js"
export type { DesignSystem, Skill } from "./loader.js"

export { matchDesign } from "./matcher.js"
export type { MatchResult } from "./matcher.js"

export { extractProjectBrand, brandToContext } from "./auto-brand.js"
export type { ProjectBrand } from "./auto-brand.js"

export { loadDesignPrefs, saveDesignPrefs, recordSystemUsed, recordSkillUsed } from "./prefs.js"
export type { DesignPrefs } from "./prefs.js"

export { buildDesignPrompt, buildDesignOutputDir, slugify } from "./prompt-builder.js"
export type { DesignJobSpec } from "./prompt-builder.js"

export { designArtifactStore } from './artifacts.js'
export type { DesignArtifact, DesignArtifactRevision, DesignArtifactStatus, CreateDesignArtifactInput } from './artifacts.js'
