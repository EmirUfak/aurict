#!/usr/bin/env bun

import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

if (process.platform !== 'darwin') {
  console.log('Skipping macOS icon preparation outside macOS.');
  process.exit(0);
}

const root = join(import.meta.dir, '..');
const resources = join(root, 'apps', 'desktop', 'resources');
const source = join(resources, 'hoprel-icon.png');
const iconset = join(resources, '.hoprel-icon.iconset');
const output = join(resources, 'hoprel-icon.icns');

if (!existsSync(source)) throw new Error(`Hoprel PNG icon is missing: ${source}`);

const variants: Array<[string, number]> = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024],
];

function run(command: string[]): void {
  const result = Bun.spawnSync(command, { stdout: 'inherit', stderr: 'inherit' });
  if (result.exitCode !== 0) throw new Error(`Command failed: ${command.join(' ')}`);
}

rmSync(iconset, { force: true, recursive: true });
mkdirSync(iconset, { recursive: true });

for (const [filename, pixels] of variants) {
  run(['sips', '-z', String(pixels), String(pixels), source, '--out', join(iconset, filename)]);
}

run(['iconutil', '-c', 'icns', '-o', output, iconset]);
if (!existsSync(output)) throw new Error(`macOS icon generation did not produce ${output}`);

console.log(`macOS icon prepared: ${output}`);
