import path from 'node:path';
import { execFile } from 'node:child_process';
import { existsSync, readdirSync, realpathSync } from 'node:fs';
import type { FileTreeEntry } from '../shared/ipc-types.js';

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.vite', '.aurict']);
const MAX_FILE_ENTRIES = 500;

export function readFileTree(root: string): FileTreeEntry[] {
  const entries: FileTreeEntry[] = [];
  const walk = (dir: string, depth: number): void => {
    if (entries.length >= MAX_FILE_ENTRIES) return;
    let dirents: import('node:fs').Dirent[];
    try {
      dirents = readdirSync(dir, { withFileTypes: true })
        .filter((entry) => !entry.name.startsWith('.') || entry.name === '.github')
        .filter((entry) => !(entry.isDirectory() && IGNORED_DIRS.has(entry.name)))
        .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
    } catch (error) {
      console.error(`[aurict] unable to read workspace directory ${dir}`, error);
      return;
    }
    for (const entry of dirents) {
      if (entries.length >= MAX_FILE_ENTRIES) return;
      const fullPath = path.join(dir, entry.name);
      const isDir = entry.isDirectory();
      entries.push({ name: isDir ? `${entry.name}/` : entry.name, path: path.relative(root, fullPath), depth, type: isDir ? 'dir' : 'file', changed: false });
      if (isDir) walk(fullPath, depth + 1);
    }
  };
  walk(root, 0);
  return entries;
}

export function resolveWithinRoot(root: string, relPath: string): string {
  const realRoot = realpathSync(root);
  const resolved = path.resolve(realRoot, relPath);
  const normalizedRoot = realRoot.endsWith(path.sep) ? realRoot : realRoot + path.sep;
  if (resolved !== realRoot && !resolved.startsWith(normalizedRoot)) throw new Error(`Path escapes workdir: ${relPath}`);
  let existing = resolved;
  while (!existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) throw new Error(`Unable to resolve path: ${relPath}`);
    existing = parent;
  }
  const realExisting = realpathSync(existing);
  if (realExisting !== realRoot && !realExisting.startsWith(normalizedRoot)) throw new Error(`Path resolves outside workdir through a symlink: ${relPath}`);
  return resolved;
}

export function markChangedFiles(root: string, entries: FileTreeEntry[]): Promise<FileTreeEntry[]> {
  return new Promise((resolve) => {
    execFile('git', ['status', '--porcelain'], { cwd: root, timeout: 3_000 }, (error, stdout) => {
      if (error || !stdout) return resolve(entries);
      const changedPaths = new Set(stdout.split('\n').map((line) => line.slice(3).trim()).filter(Boolean));
      return resolve(entries.map((entry) => ({ ...entry, changed: changedPaths.has(entry.path) })));
    });
  });
}
