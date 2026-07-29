export const TERMINAL_INPUT_QUEUE_MAX = 64;

/** Bounded queue for synthetic navigation events only. */
export class TerminalInputQueue {
  private readonly items: string[] = [];

  constructor(private readonly capacity = TERMINAL_INPUT_QUEUE_MAX) {
    if (!Number.isInteger(capacity) || capacity < 1)
      throw new Error("Terminal input queue capacity must be a positive integer");
  }

  push(value: string): void {
    if (!value) return;
    if (this.items.length >= this.capacity) this.items.shift();
    this.items.push(value);
  }

  pushMany(values: readonly string[]): void {
    for (const value of values) this.push(value);
  }

  shift(): string | undefined {
    return this.items.shift();
  }

  get size(): number {
    return this.items.length;
  }
}

/**
 * Physical stdin always wins over synthesized mouse/navigation input. This
 * keeps Enter and Ctrl+C responsive even after a large terminal event burst.
 */
export function physicalInputFirst<T>(
  physical: T | null | undefined,
  synthetic: TerminalInputQueue,
): T | string | null | undefined {
  return physical ?? synthetic.shift();
}
