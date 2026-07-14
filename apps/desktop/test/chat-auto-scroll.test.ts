/* eslint-disable import/no-unresolved -- Bun provides this test module at runtime. */
import { describe, expect, it } from 'bun:test';
import { isNearBottom } from '../src/renderer/hooks/useChatAutoScroll.js';

describe('chat auto-scroll threshold', () => {
  it('keeps following while the reader is at the bottom', () => {
    expect(isNearBottom({ scrollHeight: 1_000, scrollTop: 752, clientHeight: 200 })).toBe(true);
  });

  it('stops following after the reader scrolls into the transcript', () => {
    expect(isNearBottom({ scrollHeight: 1_000, scrollTop: 700, clientHeight: 200 })).toBe(false);
  });
});
