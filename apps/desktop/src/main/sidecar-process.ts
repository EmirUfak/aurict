/* eslint-disable @typescript-eslint/no-explicit-any -- listener args are inherently variadic, matching Node's own EventEmitter typings */
import type { ChildProcessWithoutNullStreams } from 'node:child_process';

export interface SidecarChildHandlers {
  onMessage: (line: string) => void;
  onStderr: (chunk: string) => void;
  onSpawn: () => void;
  onError: (error: Error) => void;
  onExit: (code: number | null, signal: NodeJS.Signals | null) => void;
}

export interface SidecarChildLike {
  stdout: NodeJS.ReadableStream;
  stderr: NodeJS.ReadableStream;
  once(event: string, listener: (...args: any[]) => void): void;
}

// Wires lifecycle listeners onto a spawned sidecar child process. `getCurrent`
// is re-checked at event time (not wiring time), so a child that has since
// been replaced by a restart — but whose 'error'/'exit' arrives late — is
// recognized as stale and its event is dropped instead of rejecting the new
// child's pending requests or overwriting its runtime status.
export function wireSidecarChild(child: SidecarChildLike, getCurrent: () => SidecarChildLike | null, handlers: SidecarChildHandlers): void {
  let buffer = '';
  (child.stdout as NodeJS.ReadableStream & { setEncoding(enc: string): void }).setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    buffer += chunk;
    let idx: number;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (line) handlers.onMessage(line);
    }
  });
  (child.stderr as NodeJS.ReadableStream & { setEncoding(enc: string): void }).setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => handlers.onStderr(chunk));
  child.once('spawn', () => { if (getCurrent() === child) handlers.onSpawn(); });
  child.once('error', (error: Error) => { if (getCurrent() === child) handlers.onError(error); });
  child.once('exit', (code: number | null, signal: NodeJS.Signals | null) => { if (getCurrent() === child) handlers.onExit(code, signal); });
}

export type { ChildProcessWithoutNullStreams };