import {
  extractAndStoreMemories,
  metrics,
  notifyTaskDone,
} from "@aurict/core";
import type { AgentRunOptions, CoreMessage } from "@aurict/core";
import type { DisplayMessage } from "../conversation/types.js";
import type { AgentTurnContext } from "./app-agent-submit-types.js";

type CompletionHandlers = Pick<
  AgentRunOptions,
  "onCompaction" | "onProviderFallback" | "onFinish"
>;

function formatTokens(value: number): string {
  if (value < 1_000) return String(value);
  return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}k`;
}

export function buildAgentCompletionHandlers(
  context: AgentTurnContext,
): CompletionHandlers {
  const { params } = context;
  return {
    onCompaction: (event) => {
      params.setWasCompacted(true);
      setTimeout(() => params.setWasCompacted(false), 8_000);
      params.setContextUsage(event.after);
      params.addSystemMsg(
        `Context compacted: ${formatTokens(event.before.effectiveTokens)} → ${formatTokens(event.after.effectiveTokens)} tokens (${event.reason.replaceAll("_", " ")}).`,
      );
      params.extractedRef.current = false;
    },
    onProviderFallback: (fromProvider, toProvider) => {
      params.addSystemMsg(`⚠ ${fromProvider} unavailable — switched to ${toProvider}`);
    },
    onFinish: (result) => finishTurn(context, result),
  };
}

function finishTurn(
  context: AgentTurnContext,
  result: Parameters<NonNullable<AgentRunOptions["onFinish"]>>[0],
): void {
  const { params, text, startTime, newHistory } = context;
  if (params.streamTimerRef.current) clearTimeout(params.streamTimerRef.current);
  params.streamTimerRef.current = null;
  const finalSegmentText = params.turnHadToolRef.current
    ? params.streamTextRef.current
    : result.text;
  const finalReason = params.streamReasonRef.current;
  const stableAssistantId = params.turnAssistantIdRef.current;
  params.streamTextRef.current = "";
  params.streamReasonRef.current = "";
  params.setStreamingText(null);
  params.setStreamingReason(null);
  params.setTokens((previous) => ({
    input: previous.input + result.tokens.input,
    output: previous.output + result.tokens.output,
    cacheRead: previous.cacheRead + result.tokens.cacheRead,
    cacheWrite: previous.cacheWrite + result.tokens.cacheWrite,
    reasoning: previous.reasoning + result.tokens.reasoning,
  }));
  params.setContextUsage(result.contextUsage);
  if (result.contextUsage.effectiveTokens >= result.contextUsage.compactionThreshold) {
    params.addSystemMsg(
      "Context limit reached — earlier context will be compacted before the next request.",
    );
  }
  const duration = Date.now() - startTime;
  if (duration > 15_000) notifyTaskDone(text, duration);
  if (!params.extractedRef.current) {
    params.extractedRef.current = true;
    void extractAndStoreMemories(
      params.provider,
      params.model,
      [...newHistory, ...result.newMessages],
      params.workdir,
    ).catch(() => metrics.recordError("memory_extract"));
  }
  const updatedHistory = [...newHistory, ...result.newMessages] as CoreMessage[];
  params.historyRef.current = updatedHistory;
  params.setHistory(updatedHistory);
  params.setMessages((previous) => mergeFinishedAssistantMessage(
    previous,
    stableAssistantId,
    finalSegmentText,
    finalReason,
  ));
  params.autoContinueRef.current = resolveAutoContinue(context, result);
}

function mergeFinishedAssistantMessage(
  messages: DisplayMessage[],
  stableAssistantId: string | null,
  finalText: string,
  finalReason: string,
): DisplayMessage[] {
  const next = messages.map((message) =>
    message.pending ? { ...message, pending: false } : message,
  );
  const reasoning = finalReason ? { reasoningContent: finalReason } : {};
  if (stableAssistantId) {
    const index = next.findIndex((message) => message.id === stableAssistantId);
    const existing = next[index];
    if (existing?.blocks) {
      next[index] = {
        ...existing,
        pending: false,
        blocks: finalText
          ? [...existing.blocks, { type: "text", content: finalText, ...reasoning }]
          : existing.blocks,
      };
      return next;
    }
    if (existing) {
      next[index] = { ...existing, role: "assistant", pending: false, ...reasoning };
      if (finalText) {
        next.push({
          id: crypto.randomUUID(),
          role: "assistant",
          content: finalText,
          pending: false,
          timestamp: Date.now(),
          ...reasoning,
        });
      }
      return next;
    }
  }

  const last = next[next.length - 1];
  if ((finalText || finalReason) && last?.role !== "assistant") {
    next.push({
      id: crypto.randomUUID(),
      role: "assistant",
      content: finalText,
      pending: false,
      ...reasoning,
    });
  } else if (last?.role === "assistant") {
    next[next.length - 1] = {
      ...last,
      content: finalText,
      pending: false,
      ...reasoning,
    };
  }
  return next;
}

function resolveAutoContinue(
  context: AgentTurnContext,
  result: Parameters<NonNullable<AgentRunOptions["onFinish"]>>[0],
) {
  if (result.continuation?.shouldContinue) {
    return {
      needed: true,
      count: result.continuation.nextContinuationCount,
      ...(result.longTask?.nudge ? { prompt: result.longTask.nudge } : {}),
    };
  }
  if (result.completionGate?.shouldAutoContinue && !result.completionGate.shadowOnly) {
    return {
      needed: true,
      count: context.params.autoContinueRef.current.count + 1,
      ...(result.longTask?.nudge ? { prompt: result.longTask.nudge } : {}),
    };
  }
  return { needed: false, count: context.params.autoContinueRef.current.count };
}
