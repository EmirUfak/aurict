> Operating contract for AI coding agents in this repo. Read it fully before acting.
> Maintenance rule: keep this file short and true. Every line must change agent behavior —
> if a line doesn't, delete it. Prune anything that goes stale.

## Important rules
- **Build modular first.** No code file longer than ~500 lines. Docs, plans, and configs can a12be
  as long as needed — code must stay modular.
- **Never limit the work to fit the line cap.** If a task needs more code, split it into more
  files / modules / functions — do not cram or cut corners.
- **Think ahead.** Don't write code you already know will be rewritten. Keep entry points stable
  and isolate logic into small modules from the start, so future change is cheap.
- **Fail loud during development.** No silent default fallbacks that mask problems. If something
  fails, let it fail visibly so it can be fixed.
- **No empty try/catch blocks, ever.** Handle the error, or let it propagate. Never swallow it.
- **Don't reinvent the wheel.** Prefer mature open-source / self-hostable libraries over custom
  implementations. Before adding one, surface the choice to the user and help them qualify it.
- **Design for the end-user, not the schema.** UI and APIs serve the person using them, not the
  shape of the database.

## Working agreement
- Read a file before editing it. Never edit from memory or assumption.
- Make the smallest safe change that solves the task. Prefer small, reviewable patch-style diffs
  over full-file rewrites. No unrelated "while I'm here" edits.
- Preserve existing style, naming, and conventions in the file you touch. Don't reformat around
  your change.
- Fix the root cause, not the symptom. If the bug is in A but shows in B, fix A.
- One task at a time: finish and verify before starting the next.
- If scope or intent is genuinely ambiguous, ask ONE specific question before making irreversible
  changes. Otherwise proceed — don't ask permission for routine, reversible steps.

## Autonomy & safety
- Default to read-only exploration and analysis. When edits are needed, keep them workspace-scoped
  (inside the repo).
- Remote APIs: use READ-only calls unless the user explicitly asks otherwise. Run any requested
  WRITE as a dry-run first. Never make destructive calls against production or real data.
- Destructive commands (`rm -rf`, `DROP`, `git push --force`, `git reset --hard`, DB wipes) require
  explicit approval.
- Do not commit, push, or open PRs unless asked. Do not hand-edit generated files, lockfiles, or
  migrations.

## Accuracy & sourcing
- When a request depends on recency ("latest", "current", "as of now"), first establish the current
  date (`date -Is`) and state it, then research.
- Prefer official / primary sources: upstream vendor docs for the runtime, framework, or provider.
  Use the newest versioned docs, release notes, or changelogs. Cross-check two reputable sources for
  safety/compatibility-sensitive details.
- For library/API docs, prefer a docs MCP (e.g. Context7) if available: pin the library and version,
  fetch minimal targeted docs, summarize — no large dumps.
- Never state facts about this codebase from memory. If you don't have direct evidence from a tool
  call, verify it (read the file, grep, run it) before claiming it.

## Secrets & sensitive data
- Never print secrets (tokens, keys, credentials) to output. Never ask the user to paste them.
- Avoid commands that may leak secrets (broad `env` dumps, `cat ~/.ssh/*`). Redact sensitive strings
  in anything you display. Prefer existing authenticated CLIs.

## Reading long documents (PDFs, specs, CSVs)
- Read the full source first, then draft, then re-read the original to verify: factual accuracy, no
  invented details, wording preserved unless a rewrite was requested. Label any paraphrase as such.

## Definition of done
A task is done only when:
- The change is implemented (or the question fully answered), and
- Verification is provided when code changed: build/compile attempted, lint run, typecheck/tests
  as applicable, and errors/warnings fixed (or explicitly listed as agreed out-of-scope).
- You actually exercised the affected path — not just reasoned about it.
- Docs are updated for impacted areas, impact is explained (what changed, where, why), and any
  intentionally-skipped follow-ups are listed.
Never say "done", "should work", or "looks good" without verification evidence.


<claude-mem-context>
# Memory Context

# [Aurict] recent context, 2026-07-13 12:56pm CDT

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (21,917t read) | 1,340,674t work | 98% savings

### Jun 27, 2026
1887 7:17p 🔵 Aurict write.ts and edit.ts — Built-in Tool Implementation with Snapshot, Diff, and Safety Limits
1888 " 🔵 Aurict apps/web — ESLint setState-in-Effect Violations: All 5 Are False Positives or Acceptable Patterns
1891 7:20p 🔵 Aurict Tool Result Cache — LRU 200-Entry, TTL-Per-Tool, Blunt Invalidation Bug
1892 " 🔵 Aurict executor.ts — Bug Fixed: preWriteContent Now Captured Before Execute for TSC Skip Logic
1893 " 🔵 Aurict apps/web — ESLint Fixes Applied: 5 Errors Resolved, 0 ESLint Errors Remaining
1899 7:21p 🔵 Aurict Session Code Changes — Final State: 7 Files Changed, All Tests Green, Build Clean
### Jul 1, 2026
1978 4:04p 🔵 Aurict apps/web — AuthForm Component Architecture Mapped
1979 " 🔵 Aurict apps/web — Complete Auth System Architecture Mapped
1981 4:05p ⚖️ Aurict apps/web Auth — 5-Step Implementation Plan Defined
1983 " 🔵 Aurict apps/web — Design Token System and CSS Architecture Mapped
1984 " 🔵 Aurict apps/web — Logout Route Clears Cookies Before Same-Origin Check
1988 4:07p 🔴 Aurict apps/web — Auth Server Hardening: Origin Allowlist, Network Error Handling, Input Normalizers
1991 " 🔴 Aurict apps/web — Auth Routes Input Validation and Normalization Applied to 4 Files
1992 4:09p 🟣 Aurict apps/web — AuthForm UI Upgraded with Icons, Loading States, and Scoped OAuth
1993 " 🟣 Aurict apps/web — CLI Browser Login Page Created at /auth/device
1997 4:10p ✅ Aurict apps/web — globals.css Completely Replaced with OKLCH Design System
1998 " ✅ Aurict apps/web — Auth Hardening Phase 4 Complete: Firebase Token Size Cap + ESLint Passes
2002 4:15p 🔵 Aurict apps/web — Dev Server Already Running on Port 3000
2005 4:16p 🔵 Aurict apps/web — Dev Server Persistently Running on Port 3000
2006 4:22p 🔵 Aurict apps/web — Dev Server Already Running on Port 3000
2008 " 🔵 Aurict apps/web — Dev Server Not Actually Running on Port 3000
2010 4:25p 🔵 Aurict apps/web — Waitlist API Architecture: Resend Email + In-Memory Rate Limiter
2011 " ✅ Aurict apps/web — Resend Email Dependency Removed from Waitlist Route
2012 " 🔵 Aurict apps/web — Production Build Passes: 23 Routes, Next.js 16.2.7 Turbopack
2014 4:27p 🟣 Aurict apps/web — Changelog Page Converted to GitHub Releases-Powered Dynamic Feed
2015 " 🔵 Aurict — Version Inconsistency Across Codebase: 1.1.5 vs 1.1.3 vs 1.0.5
2016 " 🔵 Aurict — GitHub Actions Publish Pipeline: 6 npm Packages + Platform Binaries
2017 4:29p 🔴 Aurict apps/web — Changelog Page Build Failure: `revalidate = 60 * 30` Expression Rejected by Next.js
2018 " 🟣 Aurict apps/web — Changelog Lib Enhanced with Commit-Based Fallback When No GitHub Releases Exist
2021 4:30p ✅ Aurict apps/web — Final Build Pass After Changelog Lib Enhancement
2024 4:31p 🔵 Aurict apps/web — AurictLandingExact.tsx Full Architecture Mapped
2026 4:34p 🟣 Aurict apps/web — Mobile Section Repositioned as BYOK AI Assistant, Not Just Remote Approval
2028 4:36p 🔵 Aurict Mobile Flutter App — Full Architecture and Theme System Mapped
2029 " 🔵 Aurict Mobile — Font Download Failed: No Network Access in Sandbox
2030 4:41p ✅ Aurict Mobile — Font Downloads Succeeded (All 5 TTF Files Verified)
2031 " 🟣 Aurict Mobile — Typography System Upgraded: Source Serif 4 + IBM Plex Mono Bundled
2035 4:42p 🔄 Aurict Mobile Android — PDF Printer Callbacks Extracted to AurictPdfPrinter.java
2036 " 🔵 Aurict Mobile Android — MainActivity.kt Native Channel Architecture Mapped
2038 4:45p 🔴 Aurict Mobile Android — PDF Renderer Rewritten: PrintDocumentAdapter Approach Fails in Java, Replaced with PdfDocument Canvas Draw
2039 4:47p ✅ Aurict Mobile — "Aurict" Default Theme Background Colors Darkened
2043 " ✅ Aurict Mobile — Accent Gradient Removed from Icon Containers and PrimaryButton; Replaced with Flat Accent Fill
2045 4:50p ✅ Aurict Mobile — "Aurict" Theme Finalized with OKLCh-Derived Colors + Atmospheric Background Subtlety Pass
### Jul 10, 2026
2291 6:25p 🔵 Aurict Core — Phase Export Structure (Faz 0–5) in packages/core/src/index.ts
2292 " 🔵 Aurict Desktop — FinanceScreen Architecture: Research/Calculate/History Tabs with Planned Calculation Engine
2294 6:27p 🟣 Aurict Core — decimal.js@10.6.0 Installed for Deterministic Finance Calculations
2295 " 🟣 Aurict Core — Finance Engine Foundation: types.ts, decimal.ts, validation.ts Created (Faz 3 Step 1)
2297 6:29p 🟣 Aurict Core — Finance Engine: Cash-Flow Calculations Implemented (NPV, IRR, XIRR, CAGR, DCF, Amortization)
2298 " 🟣 Aurict Core — Finance Engine: Bond Metrics + Yield Shock Implemented; Finance Module Exported from Core
2299 6:32p 🔴 Finance Test Suite — 3 Bugs Found and Fixed: Missing Function, Wrong DCF Value, Bond Price Precision
2300 " 🟣 Aurict — Finance Engine Complete: 1137/1137 Tests Pass, Desktop Packages Successfully

Access 1341k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>