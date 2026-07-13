import { useCallback, useEffect, useRef, useState } from "react";
import { randomUUID } from "node:crypto";
import { agentPool } from "@aurict/core";
import type { BackgroundTask } from "../../commands/types.js";

const MAX_OUTPUT_CHARS = 50_000;
const STREAM_FLUSH_MS = 100;

interface BackgroundTaskOptions {
  provider: string;
  model: string;
  workdir: string;
  parentSessionId: string;
  getParentContext: () => string | undefined;
}

function taskId(): string {
  return `bg-${randomUUID().slice(0, 8)}`;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Starts independent worker-pool tasks for the /background command.
 *
 * A background task always gets its own worker session. Moving a currently
 * streaming main-session turn would share mutable stream/session state and can
 * duplicate tool side effects, so this hook deliberately starts a new task.
 */
export function useBackgroundTasks(options: BackgroundTaskOptions) {
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const mountedRef = useRef(true);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      for (const timer of timersRef.current.values()) clearTimeout(timer);
      timersRef.current.clear();
    };
  }, []);

  const updateTask = useCallback(
    (id: string, update: Partial<Omit<BackgroundTask, "id">>) => {
      if (!mountedRef.current) return;
      setTasks((previous) =>
        previous.map((task) => (task.id === id ? { ...task, ...update } : task)),
      );
    },
    [],
  );

  const startBackgroundTask = useCallback(
    (rawPrompt: string): string => {
      const prompt = rawPrompt.trim();
      if (!prompt) throw new Error("Background task prompt cannot be empty.");

      const id = taskId();
      const startedAt = Date.now();
      const parentContext = options.getParentContext();
      let bufferedOutput = "";
      let flushTimer: ReturnType<typeof setTimeout> | undefined;

      const flushOutput = () => {
        flushTimer = undefined;
        timersRef.current.delete(id);
        updateTask(id, { output: bufferedOutput });
      };
      const scheduleFlush = () => {
        if (flushTimer) return;
        flushTimer = setTimeout(flushOutput, STREAM_FLUSH_MS);
        timersRef.current.set(id, flushTimer);
      };

      setTasks((previous) => [
        ...previous,
        { id, prompt, startedAt, status: "running" },
      ]);

      const completion = agentPool.spawn({
        id,
        agentType: "code",
        desc: `Background ${id.slice(-4)}`,
        prompt,
        provider: options.provider,
        model: options.model,
        workdir: options.workdir,
        sessionId: options.parentSessionId,
        workerSessionId: `${id}-session`,
        onText: (delta) => {
          bufferedOutput = (bufferedOutput + delta).slice(0, MAX_OUTPUT_CHARS);
          scheduleFlush();
        },
        ...(parentContext
          ? { parentContext }
          : {}),
      });

      completion
        .then((output) => {
          if (flushTimer) clearTimeout(flushTimer);
          timersRef.current.delete(id);
          updateTask(id, { status: "done", output });
        })
        .catch((error: unknown) => {
          if (flushTimer) clearTimeout(flushTimer);
          timersRef.current.delete(id);
          updateTask(id, { status: "error", output: toErrorMessage(error) });
        });

      return id;
    },
    [options, updateTask],
  );

  const cancelBackgroundTask = useCallback(
    (id: string): boolean => {
      const task = tasks.find((candidate) => candidate.id === id);
      if (!task || task.status !== "running") return false;
      agentPool.cancel(id);
      updateTask(id, { status: "error", output: "Cancelled by user." });
      return true;
    },
    [tasks, updateTask],
  );

  return { tasks, startBackgroundTask, cancelBackgroundTask };
}
