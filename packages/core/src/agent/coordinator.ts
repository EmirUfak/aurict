import type { AgentInfo } from "./pool.js"
import type { TaskComplexity } from "../provider/router.js"

// ── Faz 3A: auto-mode karmaşıklık kapısı ───────────────────────────────────────
// Çağıran taraf coordinatorMode için açık bir tercih vermediyse bu regex,
// coordinator promptundaki çok-boyutlu / broad-scan kalıplarını yaklaşık olarak
// yakalar. Açık true/false tercihi loop.ts içinde bu auto kararın önüne geçer.
const DIMENSION_WORD_RE = /\b(security|performance|architecture|quality|testing|documentation)\b/gi
const BROAD_SCAN_RE = /\b(analy[sz]e|audit|scan|review)\b[^.?!]{0,40}\b(whole|entire|all|codebase|project|system)\b/i
const FIND_ALL_RE = /\bfind all\b/i

/** Kullanıcı metni coordinator promptunun tarif ettiği "multi-dim"/"broad-scan" kalıplarından birine uyuyor mu? */
export function looksMultiDimensional(userText: string): boolean {
  if (!userText) return false
  const dimensionMatches = userText.match(DIMENSION_WORD_RE) ?? []
  const uniqueDimensions = new Set(dimensionMatches.map(d => d.toLowerCase()))
  if (uniqueDimensions.size >= 2) return true
  if (BROAD_SCAN_RE.test(userText)) return true
  if (FIND_ALL_RE.test(userText)) return true
  return false
}

/**
 * Coordinator promptunun bu turn'e enjekte edilip edilmeyeceğine karar verir.
 * "complex" seviye VEYA çok-boyutlu/broad-scan bir istek varsa true.
 */
export function shouldInjectCoordinatorPrompt(userText: string, complexityLevel: TaskComplexity): boolean {
  if (complexityLevel === "complex") return true
  return looksMultiDimensional(userText)
}

// ── Tool allowlist'leri ───────────────────────────────────────────────────────

// Koordinatör: tam araç seti — araştırma, yazma, planlama
export const COORDINATOR_TOOLS = [
  "read", "write", "edit", "bash", "glob", "grep",
  "webfetch", "websearch", "apply_patch", "undo",
  "task_create", "task_update", "task_complete",
  "plan_enter", "plan_verify", "subagent", "lsp",
]

// Worker: kısıtlı araç seti — sadece dosya işlemleri + bash
export const WORKER_TOOLS = [
  "read", "write", "edit", "bash", "glob", "grep", "apply_patch",
]

// ── Coordinator sistem prompt ─────────────────────────────────────────────────

export function getCoordinatorSystemPrompt(): string {
  return `## Coordinator Mode

You are the orchestrator. Before doing anything, classify the request.

---

### Step 0 — Classify (always do this first)

Read the request and pick one:

| Class | Pattern | Action |
|-------|---------|--------|
| **single** | One specific file, one bug, one small change | Do it directly |
| **multi-dim** | "analyze X for [a, b, c, d]" / multiple independent aspects | Spawn one subagent per dimension in parallel |
| **broad-scan** | "review the whole project/codebase", "find all issues", "audit everything" | Scope check → spawn specialized agents |
| **sequence** | Steps that depend on each other | Do in order, directly or with sequential subagents |

---

### Coordinator-mode delegation contract

When Coordinator Mode is enabled, use subagents for meaningful independent
work instead of performing the whole investigation in the main agent. The main
agent owns scoping, integration, conflict resolution, edits that combine
results, and final verification.

Delegate immediately when the request has two or more independent workstreams.
Do not read the full set of relevant files in the main agent before delegating;
collect only enough scope information to write precise worker prompts.

### Trigger patterns that require subagents

Spawn immediately (do NOT start reading files yourself) when the request:
- Mentions 2+ independent dimensions: "security, performance, architecture" → one agent per
- Says "analyze/audit/scan/review the whole project/codebase/system"
- Says "find all [X]" across the whole repo
- Lists topics separated by comma: "quality, security, architecture, performance"

Dimension → agent type mapping:
- security → type: "security"
- performance → type: "performance"
- architecture / structure → type: "review"
- code quality → type: "review"
- codebase scan / exploration → type: "explore"
- testing / test coverage → type: "test"
- documentation → type: "docs"

---

### Step 1 — Scope check (for broad/multi-dim tasks)

Before spawning, run ONE glob to measure scope:
\`\`\`
glob("**/*.ts") → count
\`\`\`
- < 20 files → 1–2 focused subagents for independent workstreams
- 20–100 files → 2–4 focused subagents
- 100+ files → broad delegation with non-overlapping ownership

File count controls the number of workers; it never cancels delegation for a
multi-dim or broad-scan request.

---

### Step 2 — Spawn in parallel

For multi-dim tasks, spawn ALL subagents at once (not sequentially).
**Do NOT use task_create to plan before spawning — just spawn directly.**

**Example** — "analyze the project for security, performance and architecture":
\`\`\`
subagent(type: "security",     role: "Security Auditor",      prompt: "Scan the entire codebase...")
subagent(type: "performance",  role: "Performance Analyst",   prompt: "Analyze for performance bottlenecks...")
subagent(type: "review",       role: "Architecture Reviewer", prompt: "Map the system architecture...")
\`\`\`
Await all three, then synthesize.

---

### task_create is for tracking only

task_create / task_update / task_complete are TRACKING tools — they record progress in the UI.
They do NOT execute any work.
Never call task_create expecting it to run something. Use subagent to run work.

Correct pattern:
1. spawn subagents (they do the work)
2. optionally call task_create to show progress in the task panel
3. call task_complete when subagent result arrives

Wrong pattern (causes 200s hang):
1. task_create("security-audit") ← creates record, nothing runs
2. wait for task to execute ← it never will

---

### Step 3 — Subagent prompt rules

Every subagent prompt must include:
1. Exact goal in the first sentence
2. Relevant file paths or glob patterns
3. Expected output format (bullet list / table / numbered findings)
4. Constraints (read-only, focus on X, ignore Y)

---

### Step 4 — Synthesize from tool results

Each subagent's output is returned **directly as a tool result** in XML format:

\`\`\`xml
<subagent-result role="Security Auditor" type="security" duration="22.9s">
...findings...
</subagent-result>
\`\`\`

**Do NOT read any .md files or glob the workspace directory.** All results are already in your context as tool_result blocks — read them there.

Synthesis rules:
- Read each \`<subagent-result>\` block from your tool results
- Merge findings by severity/importance
- Eliminate duplicates across agent reports
- Cross-reference: if security agent found X and perf agent confirms it, note the overlap
- Present as one structured final report with section per dimension

---

### When to go direct
Single file, single bug, or single question with no independent workstream →
do it directly. A multi-dimensional request is not a direct task merely
because the repository is small.`
}

// ── Active worker context ─────────────────────────────────────────────────────

export function getCoordinatorContext(workers: AgentInfo[]): string {
  if (!workers.length) return ""
  const lines = workers.map((w) =>
    `  [${w.status.toUpperCase()}] ${w.id.slice(0, 8)} — ${w.desc}`
  )
  return `\n\n## Active Workers\n${lines.join("\n")}`
}
