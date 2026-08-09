/* eslint-disable import/no-unresolved -- Bun provides this test module at runtime. */
import { describe, expect, it } from 'bun:test';
import { asyncErrorReducer } from '../src/renderer/hooks/useAsyncError.js';

describe('asyncErrorReducer', () => {
  it('bumps errorSeq on every failure, even repeated identical messages', () => {
    const first = asyncErrorReducer({ error: null, errorSeq: 0 }, { type: 'fail', message: 'Boom' });
    expect(first).toEqual({ error: 'Boom', errorSeq: 1 });

    const second = asyncErrorReducer(first, { type: 'fail', message: 'Boom' });
    expect(second).toEqual({ error: 'Boom', errorSeq: 2 });
  });

  it('clears the error without touching errorSeq', () => {
    const failed = { error: 'Boom', errorSeq: 3 };
    expect(asyncErrorReducer(failed, { type: 'clear' })).toEqual({ error: null, errorSeq: 3 });
  });

  it('is a no-op to clear when already clear', () => {
    const clean = { error: null, errorSeq: 3 };
    expect(asyncErrorReducer(clean, { type: 'clear' })).toBe(clean);
  });
});
