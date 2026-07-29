import type { CoreMessage } from "ai"
import { createHash } from "node:crypto"
import { extractText, extractFilePaths } from "./context-compactor.js"
import { extractErrorChains } from "./compaction-errors.js"
import { storeToolOutputArtifact } from "../tool/output-artifacts.js"

const TOOL_HANDLE_RE = /tool-output:[a-f0-9]{64}/g
const VERIFICATION_RE =
  /\b(?:pass(?:ed)?|fail(?:ed)?|error|warning|exit code|typecheck|lint|test|build|verification)\b/i

export interface ContextCheckpoint {
  archiveHandle?: string
  archiveHash: string
  ledger: string
}

export async function createContextCheckpoint(
  messages: CoreMessage[],
  cfg: { workdir?: string; sessionId?: string },
): Promise<ContextCheckpoint> {
  const transcript = fullTranscript(messages)
  const archiveHash = createHash("sha256").update(transcript).digest("hex")
  const stored = cfg.workdir && cfg.sessionId
    ? await storeToolOutputArtifact({
        workdir: cfg.workdir,
        sessionId: cfg.sessionId,
        output: transcript,
      })
    : undefined
  return {
    archiveHash,
    ...(stored ? { archiveHandle: stored.handle } : {}),
    ledger: deterministicLedger(messages),
  }
}

export function formatContextCheckpoint(checkpoint: ContextCheckpoint): string {
  return [
    "## DETERMINISTIC_CONTEXT_LEDGER",
    `SOURCE_SHA256: ${checkpoint.archiveHash}`,
    checkpoint.archiveHandle
      ? `SOURCE_ARCHIVE: ${checkpoint.archiveHandle} (retrieve with read_tool_output)`
      : "SOURCE_ARCHIVE: unavailable (anonymous session)",
    checkpoint.ledger,
  ].join("\n")
}

function fullTranscript(messages: CoreMessage[]): string {
  return messages
    .map((message, index) => {
      return `[#${index + 1} ${message.role}]\n${JSON.stringify(message)}`
    })
    .join("\n\n")
}

function deterministicLedger(messages: CoreMessage[]): string {
  const texts = messages.map(message => extractText(message))
  const files = unique(texts.flatMap(extractFilePaths)).slice(0, 120)
  const handles = unique(texts.flatMap(text => text.match(TOOL_HANDLE_RE) ?? [])).slice(0, 120)
  const errors = unique(extractErrorChains(messages).map(chain => chain.error)).slice(0, 80)
  const verification = unique(
    texts.flatMap(text => text.split(/\r?\n/).filter(line => VERIFICATION_RE.test(line))),
  ).slice(0, 80)
  return [
    ledgerSection("FILES", files),
    ledgerSection("TOOL_OUTPUT_ARCHIVES", handles),
    ledgerSection("ERRORS", errors),
    ledgerSection("VERIFICATION", verification),
  ].join("\n")
}

function ledgerSection(title: string, values: string[]): string {
  return `${title}:\n${values.length ? values.map(value => `- ${value}`).join("\n") : "- none recorded"}`
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))]
}
