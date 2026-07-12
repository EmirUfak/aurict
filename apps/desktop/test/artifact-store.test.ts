/* eslint-disable import/no-unresolved -- Bun provides this test module at runtime. */
import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createArtifactStore } from '../src/main/artifact-store.js';

const created: string[] = [];
afterEach(() => { for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe('desktop artifact store', () => {
  it('returns metadata without exposing the file path and resolves only registered files', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'aurict-artifact-')); created.push(root);
    const designs = path.join(root, 'designs'); mkdirSync(designs);
    const output = path.join(designs, 'report.pdf'); writeFileSync(output, 'placeholder');
    const store = createArtifactStore(() => root, () => path.join(root, 'workspace'));
    store.register({ id: 'report-1', title: 'Report', kind: 'pdf', lifecycle: 'ready', source: 'aurict-managed', path: output, workspace: path.join(root, 'workspace'), createdAt: 1, updatedAt: 1 });

    expect(store.list()).toEqual([expect.objectContaining({ id: 'report-1', kind: 'pdf' })]);
    expect(JSON.stringify(store.list())).not.toContain(output);
    expect(store.resolve('report-1').path).toBe(output);
  });

  it('rejects a path outside the declared artifact root', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'aurict-artifact-')); const outsideRoot = mkdtempSync(path.join(tmpdir(), 'aurict-artifact-outside-')); created.push(root, outsideRoot);
    const outside = path.join(outsideRoot, 'outside.pdf'); writeFileSync(outside, 'placeholder');
    const store = createArtifactStore(() => root, () => path.join(root, 'workspace'));
    expect(() => store.register({ id: 'outside-1', title: 'Outside', kind: 'pdf', lifecycle: 'ready', source: 'aurict-managed', path: outside, workspace: root, createdAt: 1, updatedAt: 1 })).toThrow('outside its approved root');
  });
});
