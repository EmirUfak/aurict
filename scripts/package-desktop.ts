#!/usr/bin/env bun

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');
const desktopRoot = join(root, 'apps', 'desktop');
const forgeHome = join(desktopRoot, '.forge-system-home');
const forgeCli = join(desktopRoot, 'node_modules', '@electron-forge', 'cli', 'dist', 'electron-forge.js');
const command = process.argv[2] ?? 'package';
const commandArgs = process.argv.slice(3);

if (!['package', 'make'].includes(command)) throw new Error(`Unsupported Forge command: ${command}`);

mkdirSync(forgeHome, { recursive: true });
// Forge 7 does not recognise Bun as a package manager and fails its own
// preflight despite dependencies being present on disk. Scope its documented
// skip marker to this generated build home, never to the user's real home.
writeFileSync(join(forgeHome, '.skip-forge-system-check'), '', 'utf8');

const result = Bun.spawnSync(['node', '--unhandled-rejections=strict', forgeCli, command, ...commandArgs], {
  cwd: desktopRoot,
  env: { ...process.env, HOME: forgeHome },
  stdout: 'inherit',
  stderr: 'inherit',
});

process.exit(result.exitCode);
