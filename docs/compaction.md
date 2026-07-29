# Session Compaction

When a conversation approaches the model's context limit, Aurict automatically compacts it — replacing the accumulated history with a structured summary that preserves the essential information.

## When compaction triggers

Compaction starts before the provider's hard limit. Aurict first calculates the
safe request threshold as `context window - maximum output - 20,000 safety
tokens`, then starts a checkpoint at 70% of that threshold once history contains
at least 8,000 estimated tokens.

| Condition | Default | Config key |
|-----------|---------|-----------|
| Effective prompt reaches the proactive threshold | 70% of the safe request threshold | automatic |
| Message count exceeds threshold | 100 messages | `compaction.messageCountThreshold` |

---

## Compaction strategies

Aurict chooses between two checkpoint paths. The configured
`aggressive`, `balanced`, or `conservative` setting adjusts their output length
and retained tail; set it via `/config set compaction.strategy <strategy>`.

### `snip` (for tool-heavy sessions)

Used when > 55% of context is tool output. Makes one LLM call to summarize tool operations.

**Output format:**
```
MODIFIED_FILES: exact paths of files read, written, or edited
COMMANDS_RUN: bash commands and outcomes (success/fail/error)
ERRORS_FIXED: bugs and resolutions (verbatim error messages)
CURRENT_STATE: one sentence on where the task stands
```

Conversation messages are preserved; only tool call/result pairs are summarized.
If this result does not meet the target token budget, Aurict retries with a full
session checkpoint before committing anything.

### `session` (default)

Full session compaction. Makes one LLM call to produce a structured summary.

**Output format:**
```
MODIFIED_FILES: exact file paths (verbatim — never paraphrased)
DECISIONS: architectural/design choices and reasons
ERRORS: bugs found and fixes applied (exact error text)
CURRENT_STATE: what works, what is broken, what is in progress
NEXT_STEPS: what still needs to be done
```

After summarization, files mentioned in the summary are re-injected with their current content (up to 3 files, 4 000 chars each).

---

## Strategy selection logic

```
tool output > 55%          →  snip
otherwise                  →  session
```

Aurict does not heuristically delete conversation history at a compaction
boundary. The summary is produced by the active conversation model; compaction
never silently switches to a cheaper or different model.

The `strategy` config setting adjusts behavior within each path:

| Setting | Effect |
|---------|--------|
| `aggressive` | Shorter summaries, fewer tail turns preserved |
| `balanced` | Default behavior |
| `conservative` | Longer summaries, more tail turns preserved |

---

## Tail turns

The `tailTurns` setting controls how many recent conversation turns are preserved verbatim after compaction (not summarized):

```bash
aurict /config set compaction.tailTurns 3
```

Default: 2. Conservative strategy adds 2 extra turns; aggressive subtracts 1.

---

## Circuit breaker

If compaction's summarizer LLM call fails 3 times in a row (each after its own transient retry — see below), the circuit breaker opens. While open, Aurict fails **loud** with an actionable message rather than silently degrading summary quality: the active model is likely rate-limited or down, so wait a moment and retry. This prevents infinite retry loops on persistent provider outages while **never** substituting a low-quality heuristic summary or another model.

### Transient retry (quality-preserving)

Before a failure counts toward the circuit breaker, Aurict retries the summarizer call up to 3 times on transient errors only (`429`, `503`, `502`, `overload`, `unavailable`, `timeout`, network errors). A `Retry-After` hint, when the provider sends one, is honoured. Overlays are cancelled immediately (never retried) so ESC stays responsive. Because most "could not compact" failures are transient, this makes the circuit-open path rare in practice.

### Hard timeout & cancel

Each compaction operation runs under a strict **45-second total** deadline and is wired to the session's abort signal. Pressing cancel aborts compaction in-flight and leaves the original conversation unchanged.

### Summary quality guardian

After the summary is produced, Aurict verifies it contains the required sections (`MODIFIED_FILES`, `DECISIONS`, `ERRORS`, `CURRENT_STATE`, `NEXT_STEPS` for session; `MODIFIED_FILES`, `COMMANDS_RUN`, `ERRORS_FIXED`, `CURRENT_STATE` for snip). If any are missing, a single targeted retry re-asks for the full structured summary. This structurally prevents the common failure mode where a vague summary drops specific values — so summaries hold up better than a one-shot summary alone.

---

## Lossless checkpoint archive

Before any summarized messages are replaced, Aurict stores their exact transcript
under `.aurict/tool-results/<session>/` and places its
`tool-output:<sha256>` handle in the summary. The `read_tool_output` tool can
retrieve that source later. A deterministic ledger also preserves exact file
paths, prior tool-output handles, error chains, and verification lines.

The replacement is transactional: Aurict commits the new history only after the
required sections pass validation and the result is both smaller than the
original and below the target budget. On timeout, cancellation, provider error,
invalid structure, or insufficient reduction, the original history remains
active.

Repeated checkpoints are hierarchical: a later checkpoint summarizes the prior
validated checkpoint plus newer turns while retaining the older source archive
handle.

Automatic continuation instructions are internal control messages. They are not
rendered as user messages, added to command history, or retained in persistent
conversation history, including when a continuation turn crosses a compaction
boundary.

---

## Post-compact file re-injection

After `session` compaction, file paths mentioned in the summary are resolved and their current content is injected:

- Up to 3 files
- Up to 4 000 chars per file
- Unsafe or unreadable paths are skipped with a diagnostic warning

This ensures the model immediately has the relevant source code in context after a compaction boundary.

---

## Memory extraction before compaction

Before compaction fires, `extractAndStoreMemories` is called on the current conversation. Facts worth remembering (user preferences, project decisions, key discoveries) are extracted and stored in SQLite.

These memories are re-injected into every future session's system prompt under `## What I Remember`, independent of the compacted context.

---

## Compaction boundary markers

Each compacted summary includes a UUID boundary marker:

```
[COMPACT:a3b2f1c8]
```

This makes compaction points traceable in session history and helps with debugging context issues.

---

## Manual compaction

Force a compaction at any time:

```
/compact
```

---

## Viewing context usage

On wide terminals, the context bar shows exact estimated counts and percentage:

```
ctx 94,041/128,000 (73%)
```

Compaction notices separately show history, system prompt, tool schemas,
attachments, safety margin, effective before/after values, and the exact number
of reclaimed estimated tokens. `/ctx` uses the same integer formatting.

Color coding:
- Green: < 60% used
- Yellow: 60–85% used  
- Red: > 85% used (compaction imminent)
