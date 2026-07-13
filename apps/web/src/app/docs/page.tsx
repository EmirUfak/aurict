import { Nav } from "@/components/Nav"
import { Footer } from "@/components/sections/Footer"
import type { Metadata } from "next"
import { getLocale } from "next-intl/server"
import { localizedMetadata } from "@/i18n/metadata"
import type { AppLocale } from "@/i18n/routing"
import { localizeDocsSections, localizeDocsBreadcrumbJsonLd, localizeDocsArticleJsonLd } from "@/content/docs-translations"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale() as AppLocale
  return localizedMetadata(locale, "/docs", locale === "tr" ? "Dokümantasyon — Başlangıç" : "Documentation — Getting Started", locale === "tr" ? "Aurict'i kurun, sağlayıcıları ve API anahtarlarını yapılandırın, MCP sunucularını bağlayın ve çoklu ajan orkestrasyonunu kullanın." : "Install Aurict, configure providers and API keys, create custom tools and skills, connect MCP servers, manage sessions, use hooks, and understand multi-agent orchestration.")
}

const DOCS_SECTIONS = [
  {
    title: "Product Surfaces",
    anchor: "product-surfaces",
    content: [
      {
        heading: "Terminal agent",
        body: "The CLI is the primary Aurict runtime: BYOK providers, project context, typed tools, checkpoints, sessions, skills, MCP, hooks, local API access, and multi-agent workflows run where developers already work.",
        code: "aurict\n/config\n/providers\n/sessions\n/agent\n/mcp",
      },
      {
        heading: "Web platform",
        body: "The web app is the public trust and onboarding surface. It contains the landing page, docs, roadmap, changelog, manifesto, Firebase-backed auth, browser login flow, privacy policy, terms, and account deletion direction.",
        code: "apps/web\n/routes: /docs /roadmap /changelog /about /privacy /terms /auth/device",
      },
      {
        heading: "Mobile BYOK assistant",
        body: "The Flutter app extends Aurict beyond the terminal: BYOK chat, provider sessions, research and document workflows, PDF generation, scoped assistant-answer reporting, and Android release hardening.",
        code: "mobile/lib/main.dart\nmobile/lib/agent/mobile_chat_stream.dart\nmobile/lib/agent/mobile_feedback_report.dart",
      },
    ],
  },
  {
    title: "Security & Privacy",
    anchor: "security-privacy",
    content: [
      {
        heading: "Secret boundaries",
        body: "Provider keys, Firebase service files, Android keystores, key properties, local env files, SQLite runtime data, and backend prototype files are excluded from source control. CI restores release secrets from GitHub Actions secrets when producing Android artifacts.",
        code: ".env\n.env.local\ngoogle-services.json\n*.jks\n*.keystore\nkey.properties\napps/backend/",
      },
      {
        heading: "Account and feedback flows",
        body: "The web and mobile surfaces include privacy, terms, account deletion, and report-feedback paths. Reported assistant answers are treated as scoped feedback events for review, not as a blanket upload of a user's project.",
        code: "POST /feedback/reports\nPOST /account/delete\n/privacy\n/terms",
      },
    ],
  },
  {
    title: "Installation",
    anchor: "installation",
    content: [
      {
        heading: "macOS and Linux",
        body: "Download the matching self-contained release binary without installing Node.js or Bun. The installer verifies the release SHA-256 checksum before installing to ~/.local/bin.",
        code: "curl -fsSL https://aurict.com/install.sh | bash",
      },
      {
        heading: "npm",
        body: "Use npm when you prefer package-manager updates or are on Windows. The correct platform binary (macOS arm64/x64, Linux x64/arm64, Windows x64) is selected automatically.",
        code: "npm install -g aurict",
      },
      {
        heading: "Direct release binary",
        body: "Use a GitHub Release when you need a portable binary, an offline-friendly deployment, or a fully manual installation. Download the asset for your operating system and CPU architecture, then compare its SHA-256 hash with the matching entry in checksums.txt before you run it.",
        code: "# Linux x64\ncurl -LO https://github.com/aurict/aurict/releases/latest/download/aurict-linux-x64\ncurl -LO https://github.com/aurict/aurict/releases/latest/download/checksums.txt\nsha256sum -c checksums.txt --ignore-missing\nchmod +x aurict-linux-x64\n./aurict-linux-x64\n\n# Windows PowerShell\nInvoke-WebRequest https://github.com/aurict/aurict/releases/latest/download/aurict-win32-x64.exe -OutFile aurict.exe\nInvoke-WebRequest https://github.com/aurict/aurict/releases/latest/download/checksums.txt -OutFile checksums.txt\nGet-FileHash .\\aurict.exe -Algorithm SHA256",
      },
      {
        heading: "Versioned, custom-directory, and removal options",
        body: "The one-line installer accepts a release version and an installation directory through environment variables. It installs only the Aurict binary; removing that binary removes this installation method. npm users can uninstall with npm.",
        code: "# Install a specific version into a custom user directory\nAURICT_INSTALL_VERSION=1.2.0 AURICT_INSTALL_DIR=~/.local/bin curl -fsSL https://aurict.com/install.sh | bash\n\n# Remove the curl-installer binary\nrm ~/.local/bin/aurict\n\n# Remove the npm package\nnpm uninstall -g aurict",
      },
      {
        heading: "First run",
        body: "Navigate to any project directory and launch. A setup wizard runs on first launch — pick a provider, enter your API key, and choose a model. Takes about 30 seconds.",
        code: "cd your-project\naurict",
      },
      {
        heading: "Build from source",
        body: "Clone the repo and build with Bun. Requires Bun >= 1.1.",
        code: "git clone https://github.com/aurict/aurict\ncd aurict\nbun install\nbun run build",
      },
    ],
  },
  {
    title: "Configuration",
    anchor: "configuration",
    content: [
      {
        heading: "Project config — .aurict/config.json",
        body: "Place a config file in your project root or in ~/.aurict/ for global defaults. Project config overrides global config, CLI flags override both.",
        code: '{\n  "provider": "anthropic",\n  "model": "claude-sonnet-4-6",\n  "maxTokens": 8192,\n  "stream": true\n}',
      },
      {
        heading: "API keys via /config",
        body: "Set API keys from inside the terminal UI. Keys are encrypted and saved to ~/.aurict/config.json, persisting across sessions.",
        code: "# Inside the Aurict terminal:\n/config set anthropic sk-ant-...\n/config set openai sk-...\n/config set google AIza...\n\n# Show current config\n/config",
      },
      {
        heading: "Environment variables",
        body: "API keys can also be set via environment variables. They take precedence over config file keys.",
        code: "ANTHROPIC_API_KEY=sk-ant-...\nOPENAI_API_KEY=sk-...\nGOOGLE_GENERATIVE_AI_API_KEY=AIza...\nOPENROUTER_API_KEY=sk-or-...\nXAI_API_KEY=xai-...",
      },
    ],
  },
  {
    title: "Providers & Models",
    anchor: "providers",
    content: [
      {
        heading: "Switching providers",
        body: "Use /providers inside the TUI to see all available providers and their key status, then switch between them. A model picker opens automatically after switching.",
        code: "/providers",
      },
      {
        heading: "Supported providers",
        body: "9 providers are built in. Ollama requires no API key and works with any locally running model (llama3, mistral, deepseek-r1, etc).",
        code: "anthropic   → Claude 4 Opus, Sonnet, Haiku\nopenai      → GPT-4o, o1, o3, o4-mini\ngoogle      → Gemini 1.5 Pro/Flash, 2.0\nopenrouter  → 200+ models via one key\nxai         → Grok 2, Grok 3\nazure       → Azure OpenAI deployments\nbedrock     → Claude via AWS\nollama      → Local models (no key needed)\nopencode    → OpenCode / Zenmux",
      },
      {
        heading: "Thinking / reasoning mode",
        body: "Models that support extended thinking (claude-opus-4, o3, deepseek-r1) show a reasoning budget picker after model selection. Use /models to adjust at any time.",
        code: "/models\n# → select model → select effort (off / low / med / high / max)",
      },
    ],
  },
  {
    title: "Custom Tools",
    anchor: "custom-tools",
    content: [
      {
        heading: "Creating a tool",
        body: "Drop a .js ESM file in ~/.aurict/tools/ (global) or .aurict/tools/ (project). Project tools override global tools with the same id. Tools are loaded at startup.",
        code: "// .aurict/tools/my-tool.js\nexport default {\n  id: \"my-tool\",\n  description: \"What this tool does\",\n  parameters: {\n    type: \"object\",\n    properties: {\n      input: { type: \"string\", description: \"Input text\" }\n    },\n    required: [\"input\"]\n  },\n  async execute({ input }, ctx) {\n    return { output: input.toUpperCase() }\n  }\n}",
      },
      {
        heading: "Tool context (ctx)",
        body: "The execute function receives a ctx object with the current working directory, session ID, and an abort signal.",
        code: "async execute({ input }, ctx) {\n  const { workdir, sessionId, signal } = ctx\n  // workdir: current project path\n  // signal:  AbortSignal for cancellation\n}",
      },
    ],
  },
  {
    title: "Custom Skills",
    anchor: "custom-skills",
    content: [
      {
        heading: "Creating a skill",
        body: "Skills are Markdown files injected into the system prompt when their trigger conditions match. Place them in ~/.aurict/skills/ or .aurict/skills/.",
        code: "<!-- .aurict/skills/conventions.md -->\n---\nname: conventions\ndescription: Our team coding conventions\n---\n\nAlways use 2-space indentation.\nPrefer functional components over class components.\nNever use var — always const or let.\nAll async functions must handle errors explicitly.",
      },
      {
        heading: "Auto-injected skills",
        body: "Aurict scans your project on startup and auto-injects relevant skills from its 218+ built-in library based on detected frameworks, languages, and config files.",
        code: "# Aurict detects and injects skills for:\nnext.js, react, vue, svelte, astro\npython, fastapi, django, flask\nrust, go, java, kotlin\ndocker, kubernetes, terraform\nbun, deno, node\n# ...and 200+ more combinations",
      },
    ],
  },
  {
    title: "MCP Integration",
    anchor: "mcp",
    content: [
      {
        heading: "Using your existing MCP config",
        body: "Aurict reads your claude_desktop_config.json automatically on startup. Any MCP server you have configured for Claude Desktop works immediately — no re-configuration needed.",
        code: "# macOS\n~/Library/Application Support/Claude/claude_desktop_config.json\n\n# Linux\n~/.config/Claude/claude_desktop_config.json\n\n# Windows\n%APPDATA%\\Claude\\claude_desktop_config.json",
      },
      {
        heading: "Listing connected servers",
        body: "Use /mcp inside the TUI to see all connected MCP servers and their available tools.",
        code: "/mcp",
      },
    ],
  },
  {
    title: "Session Management",
    anchor: "sessions",
    content: [
      {
        heading: "Browsing sessions",
        body: "All sessions are persisted automatically. Use /sessions to open an interactive picker with fuzzy search, or Ctrl+R to open QuickSearch from anywhere.",
        code: "/sessions        # interactive picker\nCtrl+R           # QuickSearch (fuzzy)",
      },
      {
        heading: "Checkpoints & undo",
        body: "Aurict creates a checkpoint before every AI action. Use /undo to roll back N steps (files + conversation), or /checkpoints to list all saved states.",
        code: "/undo            # undo last step\n/undo 3          # undo last 3 steps\n/checkpoints     # list all checkpoints\n/replay <id>     # jump to any checkpoint",
      },
      {
        heading: "Forking & branching",
        body: "Fork the current session to create an independent copy, or branch the conversation to explore different approaches without losing your current state.",
        code: "/fork            # create independent copy\n/branch          # branch conversation\n/branch list     # list branches",
      },
      {
        heading: "Context compaction",
        body: "When approaching the context window limit, Aurict can compact old messages while preserving critical context. Use /compact to view or change the compaction strategy.",
        code: "/compact         # show current strategy\n/compact auto    # auto-compact at 80% usage\n/compact manual  # prompt before compacting\n/ctx             # show context usage",
      },
    ],
  },
  {
    title: "Hooks",
    anchor: "hooks",
    content: [
      {
        heading: "What are hooks?",
        body: "Hooks are shell commands that run automatically at specific lifecycle events — before a tool call, after a response, or when a session starts. Place hook configs in .aurict/hooks.json.",
        code: '{\n  "hooks": [\n    {\n      "event": "pre-tool",\n      "tool":  "bash",\n      "run":   "echo \\"About to run: $TOOL_ARGS\\""\n    },\n    {\n      "event": "post-response",\n      "run":   "notify-send \\"Aurict finished\\""\n    }\n  ]\n}',
      },
      {
        heading: "Available hook events",
        body: "Hooks can fire on these events. Environment variables provide context about the triggering event.",
        code: "pre-tool        → before any tool executes ($TOOL_NAME, $TOOL_ARGS)\npost-tool       → after tool completes ($TOOL_NAME, $TOOL_RESULT)\npre-response    → before AI generates text\npost-response   → after AI response ($RESPONSE_TEXT)\nsession-start   → on launch ($SESSION_ID, $WORKDIR)\nsession-end     → on exit",
      },
    ],
  },
  {
    title: "Multi-Agent",
    anchor: "multi-agent",
    content: [
      {
        heading: "Specialist agents",
        body: "Aurict ships 9 built-in specialist agents, each pre-configured with domain-specific tools and system prompts. Switch with /agent.",
        code: "/agent           # show agent picker\n\n# Available agents:\nomni        → General-purpose (default)\nexplore     → Codebase exploration & analysis\ncode        → Implementation & refactoring\nreview      → Code review & best practices\ntest        → Test writing & coverage\ndocs        → Documentation generation\nsecurity    → Security audit & hardening\ndebug       → Root cause analysis\nperf        → Performance profiling",
      },
      {
        heading: "Coordinator mode",
        body: "In coordinator mode, Aurict decomposes complex tasks and delegates subtasks to specialist agents running in parallel worker threads. Enable with /coordinator.",
        code: "/coordinator     # toggle coordinator mode\n/agents          # list custom agents",
      },
      {
        heading: "Custom agents",
        body: "Define custom agents in .aurict/agents/ as JSON files. Each agent can have a custom system prompt, tool restrictions, and a default model.",
        code: '// .aurict/agents/my-agent.json\n{\n  "id": "my-agent",\n  "name": "My Agent",\n  "description": "Specialized for X",\n  "system": "You are an expert in...",\n  "tools": ["bash", "read", "write"],\n  "model": "claude-sonnet-4-6"\n}',
      },
      {
        heading: "Background tasks",
        body: "Send long-running tasks to the background so you can continue chatting. Background tasks run in a separate worker and notify you when done.",
        code: "/background      # move current task to background\n/background list # list running background tasks",
      },
    ],
  },
  {
    title: "Token & Cost Tracking",
    anchor: "cost",
    content: [
      {
        heading: "Viewing session cost",
        body: "Use /cost to see a full breakdown of token usage and estimated cost for the current session. Cache reads are shown at their discounted rate.",
        code: "/cost\n\n# Example output:\n# Fresh input:   12,430 tokens   $0.037\n# Output:         3,210 tokens   $0.048\n# Cache reads:   48,200 tokens   $0.014  (10× cheaper)\n# Cache writes:   8,400 tokens   $0.031\n# ──────────────────────────────────────\n# Total:         72,240 tokens   $0.130\n# Cache savings: $0.686 saved vs no caching",
      },
      {
        heading: "Context window usage",
        body: "The context bar in the status line shows real-time context window usage. It counts fresh input + cache reads + cache writes — the true context consumed.",
        code: "/ctx             # detailed context breakdown",
      },
    ],
  },
  {
    title: "Worktrees",
    anchor: "worktrees",
    content: [
      {
        heading: "Parallel development with worktrees",
        body: "Use /worktree to create and manage git worktrees — each worktree gets its own Aurict session, letting you work on multiple branches simultaneously without stashing.",
        code: "/worktree create feature/auth   # new worktree + session\n/worktree list                  # show active worktrees\n/worktree switch feature/auth   # switch to existing\n/worktree remove feature/auth   # clean up",
      },
    ],
  },
]

export default async function DocsPage() {
  const locale = await getLocale() as AppLocale
  const tr = locale === "tr"
  const sections = locale === "tr" ? localizeDocsSections("tr") : DOCS_SECTIONS
  const breadcrumbJsonLd = localizeDocsBreadcrumbJsonLd(locale)
  const articleJsonLd = localizeDocsArticleJsonLd(locale)
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <Nav />
      <main className="marketing-main" style={{ maxWidth: 1040 }}>
        <div className="marketing-hero">
          <p className="marketing-eyebrow">{tr ? "Dokümantasyon" : "Documentation"}</p>
          <h1 className="marketing-title">{tr ? "Başlangıç" : "Getting started"}</h1>
          <p className="marketing-lede">
            {tr ? "Aurict'i kurmak, yapılandırmak ve genişletmek için gereken her şey." : "Everything you need to install, configure, and extend Aurict."}
          </p>
        </div>

        <div className="resp-docs" style={{ gap: 64 }}>
          <nav className="resp-docs-sidebar" style={{ position: "sticky", top: 80, alignSelf: "start" }}>
            <p
              className="mono"
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              {tr ? "Bu sayfada" : "On this page"}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {sections.map((s) => (
                <a key={s.anchor} href={`#${s.anchor}`} className="docs-sidebar-link">
                  {s.title}
                </a>
              ))}
            </div>
          </nav>

          <div style={{ display: "flex", flexDirection: "column", gap: 64 }}>
            {sections.map((section) => (
              <div key={section.anchor} id={section.anchor}>
                <h2 className="marketing-section-title">{section.title}</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                  {section.content.map((item) => (
                    <div key={item.heading} className="marketing-card" style={{ padding: "24px 26px", position: "relative" }}>
                      <span className="mono aur-corner" style={{ position: "absolute", top: 8, left: 8, color: "oklch(1 0 0/.18)" }}>┌</span>
                      <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600, color: "var(--text)", marginBottom: 10 }}>
                        {item.heading}
                      </h3>
                      <p
                        className="marketing-copy"
                        style={{
                          marginBottom: 14,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {item.body}
                      </p>
                      <pre className="marketing-code">
                        <code>{item.code}</code>
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
