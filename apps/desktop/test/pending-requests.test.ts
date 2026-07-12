/* eslint-disable import/no-unresolved -- Bun provides this test module at runtime. */
import { describe, expect, it } from 'bun:test';
import { requestFromSidecar, resolveNext, type PendingQueue } from '../src/main/pending-requests.js';

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
});
