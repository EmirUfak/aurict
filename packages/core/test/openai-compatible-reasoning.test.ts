import { describe, expect, test } from "bun:test"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import type { LanguageModelV1CallOptions } from "ai"
import {
  withOpenAICompatibleReasoning,
} from "../src/provider/openai-compatible-reasoning.js"
import { decideModelToolCapability } from "../src/provider/model-tool-capability.js"
import { OpenCodePlugin } from "../src/provider/opencode.js"

function paramsWithAssistant(
  content: Extract<LanguageModelV1CallOptions["prompt"][number], { role: "assistant" }>["content"],
): LanguageModelV1CallOptions {
  return {
    mode: { type: "regular" },
    inputFormat: "messages",
    prompt: [
      { role: "user", content: [{ type: "text", text: "inspect" }] },
      { role: "assistant", content },
      {
        role: "tool",
        content: [{
          type: "tool-result",
          toolCallId: "call-1",
          toolName: "read",
          result: "ok",
        }],
      },
    ],
  }
}

describe("OpenAI-compatible reasoning preservation", () => {
  test("declares OpenCode MiMo as a verified tool-capable reasoning model", () => {
    const model = new OpenCodePlugin().listModels()
      .find(candidate => candidate.id === "mimo-v2.5-free")

    expect(model).toMatchObject({
      contextWindow: 200_000,
      maxOutput: 32_000,
      supportsTools: true,
      supportsThinking: true,
    })
    expect(decideModelToolCapability(model!).supported).toBe(true)
  })

  test("copies reasoning_content onto an assistant tool-call message", () => {
    const transformed = withOpenAICompatibleReasoning(paramsWithAssistant([
      { type: "reasoning", text: "Need to inspect the target first." },
      {
        type: "tool-call",
        toolCallId: "call-1",
        toolName: "read",
        args: { path: "README.md" },
      },
    ]))

    expect(transformed.prompt[1]?.providerMetadata).toEqual({
      openaiCompatible: {
        reasoning_content: "Need to inspect the target first.",
      },
    })
  })

  test("preserves existing compatible metadata", () => {
    const params = paramsWithAssistant([
      { type: "reasoning", text: "reason" },
      {
        type: "tool-call",
        toolCallId: "call-1",
        toolName: "read",
        args: {},
      },
    ])
    const assistant = params.prompt[1]!
    assistant.providerMetadata = {
      openaiCompatible: { custom: "value" },
    }

    expect(withOpenAICompatibleReasoning(params).prompt[1]?.providerMetadata).toEqual({
      openaiCompatible: {
        custom: "value",
        reasoning_content: "reason",
      },
    })
  })

  test("does not attach private reasoning to ordinary assistant text", () => {
    const transformed = withOpenAICompatibleReasoning(paramsWithAssistant([
      { type: "reasoning", text: "private" },
      { type: "text", text: "answer" },
    ]))

    expect(transformed.prompt[1]?.providerMetadata).toBeUndefined()
  })

  test("serializes response reasoning into the following tool-result request", async () => {
    const requestBodies: Record<string, unknown>[] = []
    const provider = createOpenAICompatible({
      name: "opencode",
      baseURL: "https://example.test/v1",
      apiKey: "test-key",
      fetch: async (_url, init) => {
        requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
        const firstStep = requestBodies.length === 1
        return new Response(JSON.stringify({
          id: firstStep ? "response-1" : "response-2",
          created: 1,
          model: "mimo-v2.5-free",
          choices: [{
            message: firstStep
              ? {
                  role: "assistant",
                  content: null,
                  reasoning_content: "I must inspect the target before answering.",
                  tool_calls: [{
                    id: "call-1",
                    type: "function",
                    function: { name: "inspect", arguments: "{}" },
                  }],
                }
              : { role: "assistant", content: "Inspection complete." },
            finish_reason: firstStep ? "tool_calls" : "stop",
          }],
          usage: { prompt_tokens: 4, completion_tokens: 2 },
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      },
    })
    const model = provider("mimo-v2.5-free")
    const first = await model.doGenerate({
      mode: { type: "regular" },
      inputFormat: "messages",
      prompt: [{ role: "user", content: [{ type: "text", text: "Inspect the target." }] }],
      tools: [{
        type: "function",
        name: "inspect",
        description: "Inspect the target.",
        parameters: { type: "object", properties: {}, additionalProperties: false },
      }],
    })
    const toolCall = first.toolCalls?.[0]
    expect(first.reasoning).toBe("I must inspect the target before answering.")
    expect(toolCall).toMatchObject({ toolCallId: "call-1", toolName: "inspect" })

    await model.doGenerate(withOpenAICompatibleReasoning(paramsWithAssistant([
      { type: "reasoning", text: first.reasoning! },
      {
        type: "tool-call",
        toolCallId: toolCall!.toolCallId,
        toolName: toolCall!.toolName,
        args: JSON.parse(toolCall!.args),
      },
    ])))

    expect(requestBodies).toHaveLength(2)
    const secondMessages = requestBodies[1]?.["messages"] as Record<string, unknown>[]
    const assistant = secondMessages.find(message => message["role"] === "assistant")
    expect(assistant).toMatchObject({
      reasoning_content: "I must inspect the target before answering.",
      tool_calls: [{
        id: "call-1",
        type: "function",
        function: { name: "inspect", arguments: "{}" },
      }],
    })
    expect(secondMessages.some(message => (
      message["role"] === "tool" && message["tool_call_id"] === "call-1"
    ))).toBe(true)
  })
})
