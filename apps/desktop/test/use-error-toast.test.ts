/* eslint-disable import/no-unresolved -- Bun provides this test module at runtime. 
import { describe, expect, it, mock } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { useErrorToast } from '../src/renderer/hooks/useErrorToast.js';

describe('useErrorToast', () => {
  it('shows a toast with a retry action when an error appears', () => {
    const showToast = mock(() => undefined);
    const retry = mock(() => undefined);
    renderHook(() => useErrorToast('Something failed', retry, showToast));

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith('Something failed', 'error', { label: 'Retry', onClick: retry });
  });

  it('does not re-show the same error message twice', () => {
    const showToast = mock(() => undefined);
    const retry = mock(() => undefined);
    const { rerender } = renderHook(({ error }) => useErrorToast(error, retry, showToast), { initialProps: { error: 'Same error' } });
    rerender({ error: 'Same error' });

    expect(showToast).toHaveBeenCalledTimes(1);
  });

  it('does nothing when there is no error', () => {
    const showToast = mock(() => undefined);
    renderHook(() => useErrorToast(null, () => undefined, showToast));
    expect(showToast).not.toHaveBeenCalled();
  });
});
*/

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