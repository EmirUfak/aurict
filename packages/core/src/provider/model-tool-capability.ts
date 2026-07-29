import type { ModelInfo } from "./plugin.js"

export type ToolCapabilityReason =
  | "verified_supported"
  | "declared_unsupported"
  | "unverified"

export interface ToolCapabilityDecision {
  supported: boolean
  reason: ToolCapabilityReason
  source: ModelInfo["toolSupportSource"]
}

/**
 * Tool schemas are sent only when support is backed by provider declarations or
 * model metadata. A model-name heuristic is useful for display defaults, but is
 * not strong enough evidence to risk a provider-side 400 response.
 */
export function decideModelToolCapability(model: ModelInfo): ToolCapabilityDecision {
  if (model.supportsTools === false) {
    return {
      supported: false,
      reason: "declared_unsupported",
      source: model.toolSupportSource,
    }
  }
  if (model.toolSupportSource === "declared" || model.toolSupportSource === "metadata") {
    return {
      supported: true,
      reason: "verified_supported",
      source: model.toolSupportSource,
    }
  }
  return {
    supported: false,
    reason: "unverified",
    source: model.toolSupportSource,
  }
}

export function requiredToolCapabilityError(
  model: ModelInfo,
  decision: ToolCapabilityDecision = decideModelToolCapability(model),
): string | undefined {
  if (decision.supported) return undefined
  const evidence = decision.reason === "unverified"
    ? "has no verified tool-capability metadata"
    : "declares that tool calling is unsupported"
  return `Model '${model.id}' ${evidence}, but the selected agent requires tools. ` +
    "Choose a verified tool-capable model with /models. No provider request was sent."
}
