/* eslint-disable import/no-unresolved -- Bun provides this test module at runtime. */
import { describe, expect, it } from 'bun:test';
import { rejectNext, rejectQueue,   requestFromSidecar, resolveNext, type PendingQueue } from '../src/main/pending-requests.js';

describe('desktop sidecar request lifecycle', () => {
  it('settles a queued request and removes its timeout', async () => {
    const queue: PendingQueue<string> = [];
    const request = requestFromSidecar(queue, 'Test request', () => undefined, 100);

    resolveNext(queue, 'ready');

    await expect(request).resolves.toBe('ready');
    expect(queue).toHaveLength(0);
  });

  it('fails loudly when the sidecar does not respond', async () => {
    const queue: PendingQueue<string> = [];
    const request = requestFromSidecar(queue, 'Test request', () => undefined, 20);

    await expect(request).rejects.toThrow('Test request did not respond within 1 seconds.');
    expect(queue).toHaveLength(0);
  });

  it('forwards a sidecar error to the matching pending request', async () => {
    const queue: PendingQueue<string> = [];
    const request = requestFromSidecar(queue, 'Model list', () => undefined, 100);

    rejectNext(queue, new Error('Provider rejected the model request.'));

    await expect(request).rejects.toThrow('Provider rejected the model request.');
    expect(queue).toHaveLength(0);
  });

  // Mirrors what happens when the sidecar exits/restarts/fails to start:
  // rejectPendingRequests() in main.ts calls rejectQueue() on every queue in
  // the registry, so every request waiting on that queue must settle
  // immediately — not wait out its own timeout — and settle exactly once.
  it('rejects every pending request in a queue at once (sidecar exit/restart)', async () => {
    const queue: PendingQueue<string> = [];
    const first = requestFromSidecar(queue, 'First request', () => undefined, 5_000);
    const second = requestFromSidecar(queue, 'Second request', () => undefined, 5_000);
    expect(queue).toHaveLength(2);

    rejectQueue(queue, new Error('Aurict runtime stopped before completing the request.'));

    await expect(first).rejects.toThrow('Aurict runtime stopped before completing the request.');
    await expect(second).rejects.toThrow('Aurict runtime stopped before completing the request.');
    expect(queue).toHaveLength(0);
  });
  
  // Guards against a stray/duplicate sidecar response (or one for a request
  // that already timed out and was removed from the queue) crashing the
  // main process — resolveNext/rejectNext should just no-op if nothing is
  // waiting.
  it('ignores an unexpected response when no request is pending', () => {
    const queue: PendingQueue<string> = [];
    expect(() => resolveNext(queue, 'unexpected')).not.toThrow();
    expect(() => rejectNext(queue, new Error('unexpected'))).not.toThrow();
    expect(queue).toHaveLength(0);
  });
});
