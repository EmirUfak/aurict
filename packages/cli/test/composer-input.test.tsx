import { afterEach, describe, expect, mock, test } from "bun:test";
import React from "react";
import { cleanup, render } from "ink-testing-library";
import { MultilineInput } from "../src/tui/MultilineInput.js";

afterEach(() => cleanup());
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("working composer input", () => {
  test("Tab queues the draft instead of inserting a tab character", async () => {
    const onQueue = mock((_value: string) => {});
    const onSubmit = mock((_value: string) => {});
    const { stdin } = render(
      <MultilineInput value="" onChange={() => {}} onSubmit={onSubmit} onQueue={onQueue} disabled={false} history={[]} />,
    );
    await flush();
    stdin.write("run tests");
    await flush();
    stdin.write("\t");
    await flush();
    expect(onQueue).toHaveBeenCalledWith("run tests");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("Enter submits a priority steering draft", async () => {
    const onSubmit = mock((_value: string) => {});
    const { stdin } = render(
      <MultilineInput value="" onChange={() => {}} onSubmit={onSubmit} onQueue={() => {}} disabled={false} history={[]} />,
    );
    await flush();
    stdin.write("focus on the parser");
    await flush();
    stdin.write("\r");
    await flush();
    expect(onSubmit).toHaveBeenCalledWith("focus on the parser");
  });
});
