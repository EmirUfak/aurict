import {
  formatCompletionProof,
  readCompletionProof,
  waiveProofCriterion,
  writeCompletionProof,
} from "@aurict/core"
import type { CommandDef, CommandResult } from "./types.js"

export const proofCommands: CommandDef[] = [{
  name: "proof",
  aliases: [],
  description: "Inspect or explicitly waive completion-proof criteria",
  usage: "[json | waive <criterion> <reason>]",
  handler: async (args, ctx): Promise<CommandResult> => {
    const proof = await readCompletionProof(ctx.workdir, ctx.sessionId)
    if (!proof) return { type: "text", content: "No completion proof has been recorded for this session yet." }
    if (args[0] === "json") return { type: "text", content: JSON.stringify(proof, null, 2) }
    if (args[0] !== "waive") return { type: "text", content: formatCompletionProof(proof) }

    const criterionId = args[1]
    const reason = args.slice(2).join(" ").trim()
    if (!criterionId || !reason) {
      return { type: "error", message: "Usage: /proof waive <criterion> <reason>" }
    }
    try {
      const updated = waiveProofCriterion(proof, criterionId, reason)
      await writeCompletionProof(ctx.workdir, updated)
      return { type: "text", content: formatCompletionProof(updated) }
    } catch (error) {
      return { type: "error", message: error instanceof Error ? error.message : String(error) }
    }
  },
}]
