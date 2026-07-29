import type {
  LanguageModelV1CallOptions,
  LanguageModelV1Middleware,
} from "ai"

type PromptMessage = LanguageModelV1CallOptions["prompt"][number]

function reasoningForToolCall(message: PromptMessage): string | undefined {
  if (message.role !== "assistant") return undefined
  const hasToolCall = message.content.some(part => part.type === "tool-call")
  if (!hasToolCall) return undefined
  const reasoning = message.content
    .filter(part => part.type === "reasoning")
    .map(part => part.text)
    .join("")
    .trim()
  return reasoning || undefined
}

/**
 * AI SDK 4's compatible provider reads arbitrary assistant message fields from
 * `openaiCompatible` metadata. Preserve reasoning alongside tool calls because
 * MiMo rejects the following tool-result request when this field is missing.
 */
export function withOpenAICompatibleReasoning(
  params: LanguageModelV1CallOptions,
): LanguageModelV1CallOptions {
  return {
    ...params,
    prompt: params.prompt.map(message => {
      const reasoning = reasoningForToolCall(message)
      if (!reasoning) return message
      return {
        ...message,
        providerMetadata: {
          ...message.providerMetadata,
          openaiCompatible: {
            ...message.providerMetadata?.["openaiCompatible"],
            reasoning_content: reasoning,
          },
        },
      }
    }),
  }
}

export const openAICompatibleReasoningMiddleware: LanguageModelV1Middleware = {
  transformParams: async ({ params }) => withOpenAICompatibleReasoning(params),
}
