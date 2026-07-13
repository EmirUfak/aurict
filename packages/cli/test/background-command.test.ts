import { describe, expect, it } from "bun:test";
import { getCommand } from "../src/commands/registry.js";
import type { BackgroundTask, CommandContext, CommandResult } from "../src/commands/types.js";

function text(result: CommandResult): string {
  if (result.type === "text") return result.content;
  if (result.type === "error") return result.message;
  return JSON.stringify(result);
}

describe("/background command", () => {
  it("starts an explicit independent background task", () => {
    const prompts: string[] = [];
    const command = getCommand("background");
    const context = {
      startBackgroundTask: (prompt: string) => {
        prompts.push(prompt);
        return "bg-1234";
      },
      cancelBackgroundTask: () => false,
      bgTasks: [],
      showBgTask: () => {},
    } as unknown as CommandContext;

    const result = command!.handler(["run", "inspect", "the", "repo"], context);

    expect(prompts).toEqual(["inspect the repo"]);
    expect(text(result as CommandResult)).toContain("bg-1234 started");
  });

  it("lists, inspects, and cancels tracked tasks", () => {
    const tasks: BackgroundTask[] = [
      {
        id: "bg-1234",
        prompt: "inspect the repo",
        startedAt: Date.now() - 1_000,
        status: "running",
      },
    ];
    const inspected: string[] = [];
    const cancelled: string[] = [];
    const command = getCommand("background");
    const context = {
      startBackgroundTask: () => "bg-new",
      cancelBackgroundTask: (id: string) => {
        cancelled.push(id);
        return id === "bg-1234";
      },
      bgTasks: tasks,
      showBgTask: (id: string) => inspected.push(id),
    } as unknown as CommandContext;

    expect(text(command!.handler([], context) as CommandResult)).toContain("bg-1234");
    command!.handler(["bg-1234"], context);
    expect(inspected).toEqual(["bg-1234"]);
    expect(text(command!.handler(["cancel", "bg-1234"], context) as CommandResult)).toContain("cancelled");
    expect(cancelled).toEqual(["bg-1234"]);
  });
});
