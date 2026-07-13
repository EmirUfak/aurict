#!/usr/bin/env bun

import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');
const desktopRoot = join(root, 'apps', 'desktop');
const resourcesDir = join(desktopRoot, 'resources');
const outputName = process.platform === 'win32' ? 'aurict-sidecar.exe' : 'aurict-sidecar';
const output = join(resourcesDir, outputName);
const target = process.env.AURICT_SIDECAR_TARGET;

mkdirSync(resourcesDir, { recursive: true });

const command = [
  'bun', 'build', join(root, 'packages', 'cli', 'src', 'index.ts'),
  '--compile', '--minify',
  '--external', 'fsevents',
  // Browser drivers are optional runtime integrations. Keep their dynamic imports
  // out of the compiled sidecar even when a workspace test dependency is present.
  '--external', 'playwright-core',
  '--external', 'puppeteer-core',
  '--outfile', output,
  ...(target ? ['--target', target] : []),
];

const build = Bun.spawnSync(command, { cwd: root, stdout: 'inherit', stderr: 'inherit' });
if (build.exitCode !== 0) process.exit(build.exitCode);

const sourceData = join(root, 'packages', 'cli', 'data');
if (!existsSync(sourceData)) throw new Error(`Desktop sidecar data directory is missing: ${sourceData}`);
cpSync(sourceData, join(resourcesDir, 'aurict-data'), { recursive: true, force: true });

console.log(`Desktop sidecar prepared: ${output}`);
