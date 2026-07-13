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