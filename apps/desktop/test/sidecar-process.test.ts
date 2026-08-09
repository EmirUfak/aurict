/* eslint-disable import/no-unresolved -- Bun provides this test module at runtime. */
/* eslint-disable @typescript-eslint/no-explicit-any -- same reason: fake emitter mirrors EventEmitter's variadic listener signature */
import { describe, expect, it, mock } from 'bun:test';
import { wireSidecarChild, type SidecarChildLike } from '../src/main/sidecar-process.js';

// Minimal hand-rolled emitter — no dependency on node:events' types, so this
// test has nothing to do with whatever @types/node resolution issues the
// editor might show elsewhere.
class FakeEmitter {
  private listeners = new Map<string, Array<(...args: any[]) => void>>();
  on(event: string, listener: (...args: any[]) => void): void {
    const list = this.listeners.get(event) ?? [];
    list.push(listener);
    this.listeners.set(event, list);
  }
  once(event: string, listener: (...args: any[]) => void): void {
    const wrapped = (...args: any[]) => {
      this.listeners.set(event, (this.listeners.get(event) ?? []).filter((l) => l !== wrapped));
      listener(...args);
    };
    this.on(event, wrapped);
  }
  emit(event: string, ...args: any[]): void {
    for (const listener of this.listeners.get(event) ?? []) listener(...args);
  }
  setEncoding(encoding: string): void {
    void encoding;
  }
}

class FakeChild extends FakeEmitter {
  stdout = new FakeEmitter();
  stderr = new FakeEmitter();
}

function noopHandlers() {
  return { onMessage: () => undefined, onStderr: () => undefined, onSpawn: () => undefined, onError: () => undefined, onExit: () => undefined };
}

describe('wireSidecarChild', () => {
  it('invokes handlers for the current child on spawn/exit', () => {
    const child = new FakeChild();
    const onSpawn = mock(() => undefined);
    const onExit = mock(() => undefined);
    wireSidecarChild(child, () => child, { ...noopHandlers(), onSpawn, onExit });

    child.emit('spawn');
    expect(onSpawn).toHaveBeenCalledTimes(1);

    child.emit('exit', 1, null);
    expect(onExit).toHaveBeenCalledWith(1, null);
  });

  // Mirrors the real restart race: sidecar exits, scheduleSidecarRestart()
  // spawns a replacement before the OS delivers the old process's exit/error
  // event. wireSidecarChild re-checks getCurrent() at event time, so the
  // stale event from A must not reject B's pending requests or clobber its
  // "connected" status.
  it('ignores a stale exit/error event from a child already replaced by a restart', () => {
    const childA = new FakeChild();
    const childB = new FakeChild();
    let current: SidecarChildLike = childA;

    const onExitA = mock(() => undefined);
    const onErrorA = mock(() => undefined);
    wireSidecarChild(childA, () => current, { ...noopHandlers(), onError: onErrorA, onExit: onExitA });

    // Restart: main.ts has already moved on to childB before A's exit arrives.
    current = childB;

    const onExitB = mock(() => undefined);
    wireSidecarChild(childB, () => current, { ...noopHandlers(), onExit: onExitB });

    childA.emit('exit', 1, null);
    childA.emit('error', new Error('late failure'));
    expect(onExitA).not.toHaveBeenCalled();
    expect(onErrorA).not.toHaveBeenCalled();

    childB.emit('exit', 0, null);
    expect(onExitB).toHaveBeenCalledWith(0, null);
  });

  it('forwards buffered stdout as complete newline-delimited messages', () => {
    const child = new FakeChild();
    const messages: string[] = [];
    wireSidecarChild(child, () => child, { ...noopHandlers(), onMessage: (line) => messages.push(line) });

    child.stdout.emit('data', '{"type":"a"}\n{"type":"b"}\n{"incomplete');
    expect(messages).toEqual(['{"type":"a"}', '{"type":"b"}']);
  });

  it('drops blank lines from stdout', () => {
    const child = new FakeChild();
    const messages: string[] = [];
    wireSidecarChild(child, () => child, { ...noopHandlers(), onMessage: (line) => messages.push(line) });

    child.stdout.emit('data', '\n{"type":"a"}\n\n');
    expect(messages).toEqual(['{"type":"a"}']);
  });
});