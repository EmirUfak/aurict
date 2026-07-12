import { DesignLoader } from "./loader.js"
import type { DesignSystem, Skill } from "./loader.js"

// Maps common keywords in briefs to design system IDs and categories
const KEYWORD_HINTS: Array<{ words: string[]; ids?: string[]; categories?: string[] }> = [
  { words: ["linear", "project management", "task"],         ids: ["linear-app"] },
  { words: ["cursor", "code editor", "ide", "coding"],       ids: ["cursor"] },
  { words: ["vercel", "deployment", "next.js", "nextjs"],    ids: ["vercel"] },
  { words: ["stripe", "payment", "billing", "saas"],         ids: ["stripe"] },
  { words: ["notion", "document", "wiki", "note"],           ids: ["notion"] },
  { words: ["apple", "ios", "macos", "clean", "sf"],         ids: ["apple"] },
  { words: ["figma", "design tool", "prototype tool"],       ids: ["figma"] },
  { words: ["supabase", "postgres", "database", "db"],       ids: ["supabase"] },
  { words: ["raycast", "launcher", "spotlight"],             ids: ["raycast"] },
  { words: ["tesla", "car", "automotive", "electric"],       ids: ["tesla"] },
  { words: ["github", "git", "repository", "open source"],  ids: ["github"] },
  { words: ["spotify", "music", "audio", "streaming"],      ids: ["spotify"] },
  { words: ["airbnb", "travel", "booking", "rental"],       ids: ["airbnb"] },
  { words: ["dark", "minimal", "clean"],                     categories: ["Developer Tools"] },
  { words: ["bright", "colorful", "fun"],                    categories: ["Consumer Apps"] },
  { words: ["financial", "fintech", "banking", "money"],    categories: ["Fintech"] },
  { words: ["developer", "dev", "technical", "tech"],        categories: ["Developer Tools"] },
  { words: ["enterprise", "corporate", "professional"],      categories: ["Business"] },
]

const SKILL_KEYWORD_MAP: Record<string, string[]> = {
  "web-prototype":    ["website", "landing", "homepage", "web", "prototype", "mockup", "marketing"],
  "saas-landing":     ["saas", "software", "product landing", "startup landing"],
  "dashboard":        ["dashboard", "admin", "analytics", "panel", "metrics"],
  "pricing-page":     ["pricing", "plans", "subscription"],
  "docs-page":        ["docs", "documentation", "guide", "reference"],
  "blog-post":        ["blog", "article", "post", "content"],
  "mobile-app":       ["mobile", "app", "ios", "android", "phone"],
  "guizang-ppt":      ["presentation", "slide", "deck", "ppt", "pitch"],
  "html-ppt":         ["slides", "slideshow", "reveal"],
  "email-marketing":  ["email", "newsletter", "campaign"],
  "pm-spec":          ["spec", "product spec", "prd", "requirements"],
  "wireframe-sketch": ["wireframe", "sketch", "low-fi", "lo-fi"],
  "social-carousel":  ["social", "instagram", "twitter", "carousel", "post"],
  "magazine-poster":  ["poster", "magazine", "editorial", "print"],
  "github-dashboard": ["github", "repository", "commits", "activity"],
  "invoice":          ["invoice", "receipt", "billing"],
  "kanban-board":     ["kanban", "board", "task board", "trello"],
  "trading-analysis-dashboard-template": ["trading", "stock", "crypto", "finance chart"],
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9 ]/g, " ")
}

function scoreSystem(sys: DesignSystem, words: string[]): number {
  let score = 0
  for (const hint of KEYWORD_HINTS) {
    const matchWord     = hint.words.some(w => words.some(bw => bw.includes(w) || w.includes(bw)))
    const matchId       = hint.ids?.includes(sys.id)
    const matchCategory = hint.categories?.some(c => sys.category.toLowerCase().includes(c.toLowerCase()))

    if (matchWord) {
      if (matchId)       score += 10
      if (matchCategory) score += 4
    }
  }
  // Bonus: design system name or id appears directly in the brief
  const sysName = normalize(sys.name)
  if (words.some(w => sysName.includes(w) || w.includes(sysName))) score += 15
  if (words.some(w => sys.id.includes(w) || w.includes(sys.id.replace(/-/g, " ")))) score += 12

  // The catalog is intentionally much larger than the hand-tuned hint table.
  // Let every system participate through its own name, category, and tagline
  // while ignoring tiny connective words that would create noisy matches.
  const metadataWords = normalize(`${sys.name} ${sys.category} ${sys.tagline}`)
    .split(/\s+/)
    .filter(word => word.length >= 4)
  for (const word of words) {
    if (word.length >= 4 && metadataWords.includes(word)) score += 3
  }
  return score
}

function scoreSkill(skill: Skill, words: string[]): number {
  const keywords = [...(SKILL_KEYWORD_MAP[skill.id] ?? []), ...skill.triggers]
  return keywords.filter(keyword => {
    const normalized = normalize(keyword)
    return words.some(word => word.includes(normalized) || normalized.includes(word))
  }).length * 5
}

export interface MatchResult {
  system:       DesignSystem
  skill:        Skill
  systemScore:  number
  skillScore:   number
  alternatives: DesignSystem[]   // top 3 alternatives for the wizard
}

export function matchDesign(brief: string): MatchResult {
  const words    = normalize(brief).split(/\s+/).filter(Boolean)
  const systems  = DesignLoader.listSystems()
  const skills   = DesignLoader.listSkills()

  // Score all systems
  const scoredSystems = systems
    .map(s => ({ system: s, score: scoreSystem(s, words) }))
    .sort((a, b) => b.score - a.score)

  // Score all skills
  const scoredSkills = skills
    .map(s => ({ skill: s, score: scoreSkill(s, words) }))
    .sort((a, b) => b.score - a.score)

  const bestSystem = scoredSystems[0]?.system ?? systems[0]!
  const bestSkill  = (scoredSkills[0]?.score ?? 0) > 0
    ? scoredSkills[0]!.skill
    : (skills.find(s => s.id === "web-prototype") ?? skills[0]!)

  const alternatives = scoredSystems
    .filter(s => s.system.id !== bestSystem.id)
    .slice(0, 3)
    .map(s => s.system)

  return {
    system:      bestSystem,
    skill:       bestSkill,
    systemScore: scoredSystems[0]?.score ?? 0,
    skillScore:  scoredSkills[0]?.score  ?? 0,
    alternatives,
  }
}
