/* eslint-disable import/no-unresolved -- Bun provides this test module at runtime. */
import { describe, expect, it } from 'bun:test';
import { shouldNotify } from '../src/renderer/hooks/useErrorToast.js';

describe('useErrorToast (shouldNotify logic)', () => {
  it('notifies when a new error appears', () => {
    expect(shouldNotify('Something failed', null)).toBe(true);
  });

  it('does not notify again for the same error message', () => {
    expect(shouldNotify('Same error', 'Same error')).toBe(false);
  });

  it('does not notify when there is no error', () => {
    expect(shouldNotify(null, null)).toBe(false);
    expect(shouldNotify(null, 'previous error')).toBe(false);
  });

  it('notifies again if the error changes to a different message', () => {
    expect(shouldNotify('New error', 'Old error')).toBe(true);
  });
});