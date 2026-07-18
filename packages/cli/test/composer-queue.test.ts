import { describe, expect, test } from "bun:test";
import { addComposerItem, takeComposerItem, type ComposerQueueItem } from "../src/tui/composer-queue.js";

const item = (id: string, kind: ComposerQueueItem["kind"]): ComposerQueueItem => ({ id, kind, text: id });

describe("composer queue", () => {
  test("steering messages run before normally queued messages", () => {
    let queue: ComposerQueueItem[] = [];
    queue = addComposerItem(queue, item("queued-1", "queued"));
    queue = addComposerItem(queue, item("steer-1", "steer"));
    queue = addComposerItem(queue, item("queued-2", "queued"));
    expect(queue.map((entry) => entry.id)).toEqual(["steer-1", "queued-1", "queued-2"]);
  });

  test("taking an item preserves the remaining order", () => {
    const result = takeComposerItem([item("steer", "steer"), item("queued", "queued")]);
    expect(result.item?.id).toBe("steer");
    expect(result.remaining.map((entry) => entry.id)).toEqual(["queued"]);
  });
});
