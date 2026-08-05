# Aurict Product Overview

Aurict is a BYOK AI orchestration system. The terminal agent is the core product; the web, mobile, and backend layers exist to make that core easier to trust, distribute, and operate.

## Product surfaces

| Surface | Role | Current state |
|---|---|---|
| Terminal CLI | Primary developer runtime | BYOK providers, typed tools, permissions, sessions, skills, MCP, hooks, local HTTP API, multi-agent workflows |
| Web platform | Public trust and onboarding surface | Landing, docs, changelog, roadmap, manifesto, Firebase-backed auth, browser login, privacy, terms, account deletion direction |
| Mobile app | BYOK assistant outside the terminal | Chat, research, document/PDF workflows, provider sessions, assistant-answer reporting, Android release workflow |
| Bondley.one | Aurict fixed-income intelligence sub-product | Research workspace for bonds, yields, spreads, and comparable market analysis |
| Backend prototype | Control-plane foundation | Account deletion and feedback report routes are kept local/private and ignored by git |

## What Aurict is optimizing for

Aurict is built around disciplined orchestration rather than generic chat. The goal is to make existing LLMs work with clearer context, lower waste, stricter execution boundaries, and less flattering behavior.

- **Bring your own key:** users keep provider choice and account control.
- **Simple as possible:** reduce context inflation and unnecessary abstraction.
- **Objective assistant behavior:** answer with evidence, admit uncertainty, and research when the request depends on current facts.
- **Typed execution:** real file, shell, search, LSP, and tool work flows through explicit tool boundaries.
- **Reviewable outcomes:** checkpoints, diffs, sessions, and feedback reporting make behavior easier to inspect.

## Architecture boundaries

Aurict should be described as a product system, not as one monolithic app.

- The CLI should remain local-first for provider keys and project execution.
- The web app should own public trust pages, authentication, roadmap, changelog, and future console workflows.
- The mobile app should focus on BYOK chat/research/document work and personal assistant workflows.
- The backend should receive only explicit remote operations such as account deletion and user-submitted feedback unless future privacy documents are updated.

## Long-term direction

The roadmap moves from practical orchestration to ecosystem expansion. MicroTarget.one, a future interface/design layer, a cybersecurity vertical, and long-term model research are downstream tracks. They should be introduced only as the release discipline, account model, privacy posture, and feedback loops mature.
