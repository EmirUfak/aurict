export type Comparison = {
  slug: string
  competitor: string
  title: string
  description: string
  tagline: string
  differentiator: string
  updatedAt: string
  ourStrengths: string[]
  theirStrengths: string[]
  features: { name: string; aurict: boolean; competitor: boolean }[]
}

export const COMPARISONS: Comparison[] = [
  {
    slug: "claude-code",
    competitor: "Claude Code",
    title: "Aurict vs Claude Code",
    description:
      "Claude Code is Anthropic-first. Aurict is a terminal-native alternative focused on provider flexibility, specialist agents, contextual skills, and native binary distribution.",
    tagline: "Provider flexibility meets multi-agent power",
    differentiator: "Multi-provider + multi-agent",
    updatedAt: "2026-07-03",
    ourStrengths: [
      "Multiple AI providers — switch without changing your workflow",
      "Specialist agents for coding, review, testing, docs, security, debugging, performance, and analytics",
      "Contextual skills injected from detected project context",
      "Native binary execution after install",
      "macOS, Linux, and Windows support",
      "Command safety controls for terminal workflows",
      "MCP-oriented extensibility",
    ],
    theirStrengths: ["Official Anthropic workflow", "Tight Claude integration"],
    features: [
      { name: "Multiple AI providers", aurict: true, competitor: false },
      { name: "Specialist agent architecture", aurict: true, competitor: false },
      { name: "Contextual skills", aurict: true, competitor: false },
      { name: "Native compiled binary", aurict: true, competitor: false },
      { name: "Windows support", aurict: true, competitor: false },
      { name: "Command safety controls", aurict: true, competitor: false },
      { name: "MCP-oriented integration", aurict: true, competitor: true },
      { name: "Open source", aurict: true, competitor: true },
    ],
  },
  {
    slug: "cursor",
    competitor: "Cursor",
    title: "Aurict vs Cursor",
    description:
      "Cursor is an IDE. Aurict is a terminal AI assistant for developers who want repository-scale agent workflows without leaving the shell.",
    tagline: "Terminal-native vs IDE-bound",
    differentiator: "Terminal-native, no IDE switch required",
    updatedAt: "2026-07-03",
    ourStrengths: [
      "Works in the terminal you already use",
      "Lightweight native binary model",
      "Multi-agent orchestration",
      "Provider flexibility",
      "Contextual skills and MCP-oriented extension points",
      "SSH-friendly workflow for remote development",
    ],
    theirStrengths: ["Visual IDE experience", "Inline code suggestions", "Visual diff workflow"],
    features: [
      { name: "Terminal-native", aurict: true, competitor: false },
      { name: "IDE-based", aurict: false, competitor: true },
      { name: "Multiple AI providers", aurict: true, competitor: true },
      { name: "Specialist agents", aurict: true, competitor: false },
      { name: "Works over SSH", aurict: true, competitor: false },
      { name: "Lightweight binary", aurict: true, competitor: false },
      { name: "Inline suggestions", aurict: false, competitor: true },
      { name: "Open source", aurict: true, competitor: false },
    ],
  },
  {
    slug: "aider",
    competitor: "Aider",
    title: "Aurict vs Aider",
    description:
      "Aider is a Git-focused AI pair programmer. Aurict adds a broader terminal agent runtime with specialist agents, contextual skills, and safety controls.",
    tagline: "Agent runtime vs Git-focused pair programmer",
    differentiator: "Broader agent orchestration",
    updatedAt: "2026-07-03",
    ourStrengths: [
      "Specialist agents for different engineering tasks",
      "Multi-provider BYOK model",
      "Contextual skill injection",
      "Command safety controls",
      "Policy-oriented terminal execution",
      "Design and documentation workflows",
      "Windows native binary",
    ],
    theirStrengths: ["Strong Git workflow", "Simple single-agent mental model"],
    features: [
      { name: "Specialist agent architecture", aurict: true, competitor: false },
      { name: "Multiple AI providers", aurict: true, competitor: true },
      { name: "Contextual skills", aurict: true, competitor: false },
      { name: "Command safety controls", aurict: true, competitor: false },
      { name: "Policy-oriented execution", aurict: true, competitor: false },
      { name: "Git-focused workflow", aurict: false, competitor: true },
      { name: "Windows support", aurict: true, competitor: false },
      { name: "Open source", aurict: true, competitor: true },
    ],
  },
  {
    slug: "github-copilot",
    competitor: "GitHub Copilot",
    title: "Aurict vs GitHub Copilot",
    description:
      "GitHub Copilot is strongest as an IDE assistant and autocomplete product. Aurict is built for terminal-native agent tasks, provider choice, and repository workflows.",
    tagline: "Full terminal assistant vs IDE autocomplete",
    differentiator: "Agentic tasks, not only completions",
    updatedAt: "2026-07-03",
    ourStrengths: [
      "Full terminal assistant workflow",
      "Specialist agents",
      "BYOK provider choice",
      "Contextual skills",
      "Codebase-aware terminal execution",
      "Custom tools and MCP-oriented extension",
      "No required subscription to use the open-source core",
    ],
    theirStrengths: ["Inline IDE suggestions", "GitHub ecosystem integration"],
    features: [
      { name: "Full coding assistant", aurict: true, competitor: false },
      { name: "Specialist agent architecture", aurict: true, competitor: false },
      { name: "Multiple AI providers", aurict: true, competitor: false },
      { name: "Terminal-native", aurict: true, competitor: false },
      { name: "Inline IDE suggestions", aurict: false, competitor: true },
      { name: "GitHub ecosystem integration", aurict: false, competitor: true },
      { name: "Open source", aurict: true, competitor: false },
    ],
  },
  {
    slug: "opencode",
    competitor: "OpenCode",
    title: "Aurict vs OpenCode",
    description:
      "Both projects target terminal AI workflows. Aurict emphasizes specialist agents, contextual skills, safety controls, mobile BYOK work, and a broader product surface.",
    tagline: "Feature-rich agent runtime vs minimal terminal AI",
    differentiator: "Skills system + safety + mobile companion",
    updatedAt: "2026-07-03",
    ourStrengths: [
      "Specialist agents",
      "Multiple providers",
      "Contextual skills",
      "Command safety controls",
      "Policy-oriented execution",
      "Windows native binary",
      "Mobile BYOK assistant and companion direction",
    ],
    theirStrengths: ["Minimal approach", "Smaller surface area"],
    features: [
      { name: "Specialist agent architecture", aurict: true, competitor: false },
      { name: "Multiple AI providers", aurict: true, competitor: false },
      { name: "Contextual skills", aurict: true, competitor: false },
      { name: "Command safety controls", aurict: true, competitor: false },
      { name: "Policy-oriented execution", aurict: true, competitor: false },
      { name: "Windows support", aurict: true, competitor: false },
      { name: "Open source", aurict: true, competitor: true },
      { name: "Terminal-native", aurict: true, competitor: true },
    ],
  },
]

export function getComparison(slug: string) {
  return COMPARISONS.find((comparison) => comparison.slug === slug)
}
