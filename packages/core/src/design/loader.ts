import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { coreAssetDir } from "../storage/paths.js"

// Data dizini: packages/cli/data/  (core → cli üst dizine çıkılır)
// __dirname: packages/core/src/design → ../../../../packages/cli/data
function dataDir(): string {
  const packagedDataDir = coreAssetDir()
  if (packagedDataDir) return packagedDataDir
  const here = dirname(fileURLToPath(import.meta.url))
  return join(here, "../../../../packages/cli/data")
}

export interface DesignSystem {
  id:          string   // "linear-app", "cursor"
  name:        string   // "Linear", "Cursor"
  category:    string   // "Productivity & SaaS", "Developer Tools"
  tagline:     string   // "> Project management. Ultra-minimal..."
  content:     string   // full DESIGN.md
}

export interface Skill {
  id:          string   // "web-prototype", "dashboard"
  name:        string
  description: string
  triggers:    string[]
  mode:        string   // "prototype", "deck", "video"
  content:     string   // full SKILL.md
  hasTemplate: boolean  // assets/template.html mevcut mu
  hasLayouts:  boolean  // references/layouts.md mevcut mu
}

function parseDesignSystem(id: string, content: string): DesignSystem {
  const lines    = content.split("\n")
  const nameLine = lines.find(l => l.startsWith("# ")) ?? ""
  const name     = nameLine.replace(/^#\s*(Design System Inspired by\s*)?/, "").trim() || id
  const catLine  = lines.find(l => l.startsWith("> Category:")) ?? ""
  const category = catLine.replace(/^>\s*Category:\s*/, "").trim() || "Other"
  const tagLine  = lines.find((l, i) => i > 0 && l.startsWith(">") && !l.includes("Category:")) ?? ""
  const tagline  = tagLine.replace(/^>\s*/, "").trim()
  return { id, name, category, tagline, content }
}

function parseSkillFrontmatter(id: string, content: string): Skill {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
  if (!fmMatch) {
    return { id, name: id, description: "", triggers: [], mode: "prototype", content, hasTemplate: false, hasLayouts: false }
  }
  const fm = fmMatch[1]!

  const nameMatch = fm.match(/^name:\s*(.+)$/m)
  const name      = nameMatch?.[1]?.trim() ?? id

  // description can be multiline with |
  const descMatch = fm.match(/^description:\s*\|?\n?((?:[ \t]+.+\n?)+)/m)
  const desc      = descMatch?.[1]?.replace(/^[ \t]+/gm, "").trim() ?? ""

  const triggersMatch = fm.match(/^triggers:([\s\S]*?)(?=^\w|\Z)/m)
  const triggers: string[] = []
  if (triggersMatch) {
    for (const m of triggersMatch[1]!.matchAll(/- "([^"]+)"/g)) triggers.push(m[1]!)
  }

  const modeMatch = fm.match(/mode:\s*(\S+)/)
  const mode      = modeMatch?.[1]?.trim() ?? "prototype"

  const base        = join(dataDir(), "design-templates", id)
  const hasTemplate = existsSync(join(base, "assets", "template.html"))
  const hasLayouts  = existsSync(join(base, "references", "layouts.md"))

  return { id, name, description: desc, triggers, mode, content, hasTemplate, hasLayouts }
}

// ── Cached loaders ────────────────────────────────────────────────────────────

let _systems: DesignSystem[] | null = null
let _skills:  Skill[]       | null = null

export const DesignLoader = {
  listSystems(): DesignSystem[] {
    if (_systems) return _systems
    const dir = join(dataDir(), "design-systems")
    if (!existsSync(dir)) return []
    _systems = readdirSync(dir)
      .filter(f => f.endsWith(".md"))
      .map(f => {
        const id      = f.replace(/\.md$/, "")
        const content = readFileSync(join(dir, f), "utf8")
        return parseDesignSystem(id, content)
      })
      .sort((a, b) => a.name.localeCompare(b.name))
    return _systems
  },

  getSystem(id: string): DesignSystem | null {
    return DesignLoader.listSystems().find(s => s.id === id) ?? null
  },

  listSkills(): Skill[] {
    if (_skills) return _skills
    const dir = join(dataDir(), "design-templates")
    if (!existsSync(dir)) return []
    _skills = readdirSync(dir)
      .filter(name => existsSync(join(dir, name, "SKILL.md")))
      .map(name => {
        const content = readFileSync(join(dir, name, "SKILL.md"), "utf8")
        return parseSkillFrontmatter(name, content)
      })
      .sort((a, b) => a.id.localeCompare(b.id))
    return _skills
  },

  getSkill(id: string): Skill | null {
    return DesignLoader.listSkills().find(s => s.id === id) ?? null
  },

  getTemplateHtml(skillId: string): string | null {
    const path = join(dataDir(), "design-templates", skillId, "assets", "template.html")
    return existsSync(path) ? readFileSync(path, "utf8") : null
  },

  getLayouts(skillId: string): string | null {
    const path = join(dataDir(), "design-templates", skillId, "references", "layouts.md")
    return existsSync(path) ? readFileSync(path, "utf8") : null
  },
}
