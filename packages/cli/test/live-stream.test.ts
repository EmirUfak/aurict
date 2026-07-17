import { describe, expect, test } from "bun:test";
import { visibleLiveStream } from "../src/tui/conversation/live-stream.js";

describe("live stream visibility", () => {
  test("shows both output and reasoning while they are streaming", () => {
    expect(visibleLiveStream(
      { text: "Drafting a plan", reasoning: "Checking the repository" },
    )).toEqual({ text: "Drafting a plan", reasoning: "Checking the repository" });
  });

  test("keeps normal output and reasoning live after a tool transcript starts", () => {
    expect(visibleLiveStream(
      { text: "Final answer", reasoning: "Verifying the changed files" },
    )).toEqual({ text: "Final answer", reasoning: "Verifying the changed files" });
  });

  test("does not create empty streaming rows", () => {
    expect(visibleLiveStream({ text: "", reasoning: "" })).toEqual({
      text: null,
      reasoning: null,
    });
  });
});
