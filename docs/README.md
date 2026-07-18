# Aurict Documentation

## Getting started

- [Getting Started](getting-started.md) — installation, first run, basic usage
- [Configuration](configuration.md) — config file, environment variables, project instructions
- [Slash Commands](slash-commands.md) — full reference for all ~55 slash commands

## Product surfaces

- **Terminal CLI** — the primary Aurict agent runtime with BYOK providers, typed tools, sessions, skills, MCP, hooks, and local API.
- **Web platform** — public landing, docs, changelog, roadmap, manifesto, Firebase-backed auth, browser login, privacy, terms, and account deletion direction.
- **Mobile app** — Flutter BYOK assistant for chat, research, document/PDF workflows, provider sessions, and assistant-answer reporting.
- **Backend prototype** — local/private control-plane routes for account deletion and report ingestion. Backend files and secrets stay ignored by git.

Detailed product references:

- [Product Overview](product-overview.md) — Aurict surfaces, architecture boundaries, and product direction
- [Terminal Design Baseline](terminal-design-baseline.md) — responsive layout, transcript, tool, streaming, and composer contracts
- [Mobile App](mobile.md) — BYOK mobile assistant behavior, release path, privacy, and reporting
- [Roadmap](roadmap.md) — current phases, near-term hardening, ecosystem expansion, and research track
- [Security & Compliance](security-and-compliance.md) — current safeguards, limits, and next controls

## Core features

- [Tools Reference](tools.md) — all built-in tools, parameters, permissions, robustness features
- [Providers](providers.md) — Anthropic, OpenAI, OpenRouter, Google, Ollama, Azure, Bedrock, xAI, OpenCode
- [Skills & Project Detection](skills.md) — automatic context injection, custom skills
- [Multi-Agent Mode](multi-agent.md) — coordinator, worker types, agent pool, custom agents
- [Recipes](recipes.md) — automated multi-step workflows via YAML/JSON recipe files

## Advanced

- [LLM Robustness Layer](llm-robustness.md) — pattern-completion mitigation, re-read gating, symbol verification, dual-path TSC, stuck detection
- [Session Compaction](compaction.md) — strategies, structured summaries, memory extraction
- [MCP Servers](mcp.md) — Model Context Protocol integration, server configuration
- [HTTP API](api.md) — REST endpoints, SSE streaming, scripting
- [Hook System](hooks.md) — lifecycle hooks, blocking tools, shell hooks
