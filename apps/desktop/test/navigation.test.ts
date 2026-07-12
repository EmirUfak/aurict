/* eslint-disable import/no-unresolved -- Bun provides this test module at runtime. */
import { describe, expect, it } from 'bun:test';
import { navigationFor } from '../src/renderer/experience/navigation.js';

describe('desktop role navigation', () => {
  it('gives product and operations their own primary surfaces', () => {
    expect(navigationFor('product')[0]).toEqual({ id: 'main', label: 'product' });
    expect(navigationFor('operator')[0]).toEqual({ id: 'main', label: 'operations' });
  });

  it('keeps finance and developer power surfaces discoverable', () => {
    expect(navigationFor('finance').map((item) => item.id)).toContain('finance');
    expect(navigationFor('developer').map((item) => item.id)).toContain('design');
  });
});
