import { hooks } from "./emitter.js"
import { autoInvoker } from "../skill/auto-invoke.js"
import { observeBackground } from "../util/background-task.js"

// Programatik function hook'lar — config dosyası gerektirmez, TypeScript callback ile kayıt.
// Her fonksiyon unregister için cleanup fonksiyon döner.

// Auto-invoke: write/edit araçlarında dosya yolunu analiz et ve ilgili skill'leri inject et
hooks.on("v1.tool.before", (payload) => {
  if (payload.tool === "write" || payload.tool === "edit") {
    const filePath = String(payload.args["path"] ?? "")
    if (filePath) {
      const skillIds = autoInvoker.check("file-edit", filePath)
      if (skillIds.length > 0) {
        // v1.context.inject hook'u ateşle — injector bu event'i dinliyor
        observeBackground(hooks.emit("v1.context.inject", { skillIds }), "context injection hook")
      }
    }
  }
  return payload
})

export function onToolBefore(
  handler: (tool: string, args: Record<string, unknown>) => void,
): () => void {
  return hooks.on("v1.tool.before", (payload) => {
    handler(payload.tool, payload.args)
    return payload
  })
}

export function onToolAfter(
  handler: (tool: string, result: unknown, durationMs: number) => void,
): () => void {
  return hooks.on("v1.tool.after", (payload) => {
    handler(payload.tool, payload.result, payload.durationMs)
    return payload
  })
}

export function onCompact(
  handler: (tokensBefore: number, tokensAfter: number) => void,
): () => void {
  return hooks.on("v1.compact.after", (payload) => {
    handler(payload.tokensBefore, payload.tokensAfter)
    return payload
  })
}

export function onSessionStart(handler: (sessionId: string) => void): () => void {
  return hooks.on("v1.session.start", (payload) => {
    handler(payload.sessionId)
    return payload
  })
}

export function onAgentComplete(
  handler: (sessionId: string, result: string) => void,
): () => void {
  return hooks.on("v1.agent.complete", (payload) => {
    handler(payload.childSessionId, payload.result)
    return payload
  })
}
