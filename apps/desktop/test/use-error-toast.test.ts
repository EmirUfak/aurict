/* eslint-disable import/no-unresolved -- Bun provides this test module at runtime. */
import { describe, expect, it } from 'bun:test';
import { shouldNotify } from '../src/renderer/hooks/useErrorToast.js';

describe('useErrorToast (shouldNotify logic)', () => {
  it('notifies when a new error appears', () => {
    expect(shouldNotify('Something failed', 1, null)).toBe(true);
  });

  it('does not notify again for the same failed attempt', () => {
    expect(shouldNotify('Same error', 1, 1)).toBe(false);
  });

  it('does not notify when there is no error', () => {
    expect(shouldNotify(null, 0, null)).toBe(false);
    expect(shouldNotify(null, 3, 2)).toBe(false);
  });

  it('notifies again when a retry fails with a different message', () => {
    expect(shouldNotify('New error', 2, 1)).toBe(true);
  });

  it('notifies again when a retry fails with the exact same message', () => {
    // Regression: a naive string-equality check misses this — the message
    // is identical, but errorSeq bumped, so the retry's second failure must
    // still surface a toast instead of going silent.
    expect(shouldNotify('Same error', 2, 1)).toBe(true);
  });
});