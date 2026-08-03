/* eslint-disable import/no-unresolved -- Bun provides this test module at runtime. */
import { describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const providerEnvironment = {
  ANTHROPIC_API_KEY: 'test',
  OPENAI_API_KEY: 'test',
  OPENROUTER_API_KEY: 'test',
  GOOGLE_GENERATIVE_AI_API_KEY: 'test',
  OPENCODE_API_KEY: 'test',
  XAI_API_KEY: 'test',
  AZURE_OPENAI_API_KEY: 'test',
  AWS_ACCESS_KEY_ID: 'test',
  NVIDIA_API_KEY: 'test',
  ZAI_API_KEY: 'test',
  DASHSCOPE_API_KEY: 'test',
};

describe('desktop sidecar entry', () => {
  it('answers provider and session requests without loading the terminal input layer', async () => {
    const testHome = mkdtempSync(join(tmpdir(), 'aurict-desktop-sidecar-'));
    const entry = join(import.meta.dir, '..', 'src', 'sidecar-entry.ts');
    const child = Bun.spawn([process.execPath, 'run', entry], {
      cwd: testHome,
      env: {
        ...process.env,
        ...providerEnvironment,
        HOME: testHome,
        USERPROFILE: testHome,
        AURICT_STATE_DIR: join(testHome, '.aurict'),
      },
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
    });

    try {
      child.stdin.write('{"type":"provider:list"}\n{"type":"session:list"}\n');
      child.stdin.end();

      const result = Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);
      let timeoutId: ReturnType<typeof setTimeout>;
      const timeout = new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Desktop sidecar did not answer within 5 seconds.')), 5_000);
      });
      const [stdout, stderr, exitCode] = await Promise.race([result, timeout])
        .finally(() => clearTimeout(timeoutId));

      expect(exitCode, stderr).toBe(0);
      const messages = stdout.trim().split('\n').map((line) => JSON.parse(line) as { type: string });
      expect(messages.map((message) => message.type)).toEqual([
        'provider:list-result',
        'session:list-result',
      ]);
    } finally {
      child.kill();
      await child.exited;
      rmSync(testHome, { recursive: true, force: true });
    }
  });
});
