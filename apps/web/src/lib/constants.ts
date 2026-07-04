export const TERMINAL_SCENARIOS = [
  {
    label: "Swarm",
    lines: [
      { delay: 0,    type: "input",  text: "❯ refactor checkout, keep tests green, flag risky shell work" },
      { delay: 520,  type: "system", text: "● Mission parsed: 6 files likely relevant, 3 agents dispatched" },
      { delay: 980,  type: "tool",   text: "◆ explore.glob  src/{checkout,payments}/**/*.ts  ✓  0.2s" },
      { delay: 1350, type: "tool",   text: "◆ review.read  src/checkout/session.ts  ✓  0.1s" },
      { delay: 1730, type: "tool",   text: "◆ code.read    src/payments/gateway.ts  ✓  0.1s" },
      { delay: 2180, type: "output", text: "│ Swarm brief: session mutation leaks across retry boundary" },
      { delay: 2580, type: "output", text: "│ Plan: isolate retry state, add regression test, verify affected path" },
      { delay: 3060, type: "tool",   text: "◆ apply_patch  3 files  +74 -18  waiting for approval" },
      { delay: 3540, type: "system", text: "● GateGuard: patch preview approved, shell remains policy-sandboxed" },
      { delay: 4060, type: "tool",   text: "◆ verify.test  checkout.retry.test.ts  ✓  8 passed" },
      { delay: 4580, type: "output", text: "│ ✓ Task complete. Review agent found no behavioral regression." },
    ],
  },
  {
    label: "Guard",
    lines: [
      { delay: 0,    type: "input",  text: "❯ run the migration and clean stale build artifacts" },
      { delay: 600,  type: "system", text: "● Classifier: migration is warning-level, cleanup may be destructive" },
      { delay: 1130, type: "tool",   text: "◆ bash  bunx drizzle-kit generate  approval requested" },
      { delay: 1620, type: "output", text: "│ User approved once. Environment scrubbed for policy execution." },
      { delay: 2110, type: "tool",   text: "◆ bash  rm -rf dist .next  blocked: outside approved pattern" },
      { delay: 2660, type: "system", text: "● No panic. No crater. Destructive command parked in a containment bubble." },
      { delay: 3190, type: "tool",   text: "◆ file_stat  dist  ✓  not present" },
      { delay: 3710, type: "tool",   text: "◆ verify.tsc  packages/core  ✓  no errors" },
      { delay: 4250, type: "output", text: "│ ✓ Migration checked. Cleanup skipped until explicit approval." },
    ],
  },
  {
    label: "Debug",
    lines: [
      { delay: 0,    type: "input",  text: "❯ why does the dashboard freeze after the websocket reconnects?" },
      { delay: 560,  type: "system", text: "● Debug agent tracing event loop and React update chain" },
      { delay: 1080, type: "tool",   text: "◆ grep  \"reconnect|socket.on\"  src  ✓  12 matches" },
      { delay: 1540, type: "tool",   text: "◆ symbols  src/live/useFeed.ts  ✓  5 exports" },
      { delay: 2030, type: "output", text: "│ Found loop: reconnect handler re-subscribes without cleanup" },
      { delay: 2510, type: "output", text: "│ Perf agent: 71 duplicate listeners after third reconnect" },
      { delay: 3030, type: "tool",   text: "◆ edit  src/live/useFeed.ts  ✓  cleanup attached" },
      { delay: 3570, type: "tool",   text: "◆ verify.test  live-feed.test.ts  ✓  11 passed" },
      { delay: 4110, type: "output", text: "│ ✓ Freeze fixed. Tiny portal tremor reduced to background hum." },
    ],
  },
]

export const FEATURES = [
  {
    icon: "agents",
    title: "Multi-Agent Orchestration",
    description: "9 specialist agents running in isolated worker threads. Explore, code, review, test, docs, security, debug, performance, analytics — each a domain expert.",
    tag: "Architecture",
    color: "#38bdf8",
  },
  {
    icon: "skills",
    title: "218+ Contextual Skills",
    description: "Aurict scans your project before you say a word — framework, language, config, conventions. The right context is injected automatically.",
    tag: "Intelligence",
    color: "#a78bfa",
  },
  {
    icon: "classifier",
    title: "Bash Classifier",
    description: "Every shell command is analyzed before execution. Safe commands run instantly. Dangerous ones (rm -rf, format) trigger strict confirmation with red warnings.",
    tag: "Security",
    color: "#f59e0b",
  },
  {
    icon: "sandbox",
    title: "Sandbox Execution",
    description: "Risky executables run through a low-overhead policy sandbox: command classification, approvals, protected paths, scrubbed env, timeouts, output limits, and audit trails. Docker remains optional for heavier isolation.",
    tag: "Security",
    color: "#ff6b6b",
  },
  {
    icon: "mcp",
    title: "MCP Client",
    description: "Drop your claude_desktop_config.json and every MCP server you already use works immediately — filesystem, GitHub, Postgres, Slack, browser automation.",
    tag: "Integration",
    color: "#22d3ee",
  },
  {
    icon: "design",
    title: "Design Agent Wizard",
    description: "150+ design systems, 111 skill templates. Describe your UI idea, pick a system and skill, and a complete implementation prompt is built for you.",
    tag: "Design",
    color: "#06b6d4",
  },
  {
    icon: "windows",
    title: "Windows Native",
    description: "A real compiled binary for Windows x64 — no WSL, no extra runtime, no PowerShell gymnastics. Shell detection auto-picks Git Bash, MSYS2, or PowerShell as fallback.",
    tag: "Platform",
    color: "#38bdf8",
  },
  {
    icon: "memory",
    title: "Persistent Memory",
    description: "Project decisions, coding preferences, and team conventions stored in a local DB and recalled per-session. The AI remembers what you told it — across every restart.",
    tag: "Intelligence",
    color: "#fb7185",
  },
]

export const PRO_FEATURES = [
  { title: "Cloud sync", description: "Sessions and memories synced across machines" },
  { title: "Team workspace", description: "Shared context, skills, and agents for your team" },
  { title: "Analytics dashboard", description: "Token usage, cost tracking, agent performance" },
  { title: "Priority support", description: "Direct access to the team" },
]
