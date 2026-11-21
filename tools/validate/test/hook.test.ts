import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runValidateHook } from '../src/hook.ts';
import { nodeIo } from '../src/node-io.ts';

// Repo root as a `/`-separated prefix, so the hook sees the same path form it prints.
const ROOT = fileURLToPath(new URL('../../../', import.meta.url)).split('\\').join('/');

function lines(text: string): string[] {
  return text.split('\n').filter((l) => l !== '');
}

describe('runValidateHook (Requirements 17.2, 17.3, 17.4)', () => {
  it('passes the demo manifest with exit 0 and the PASS line on stdout', () => {
    const file = `${ROOT}activities/core-demo-study-break.json`;
    const result = runValidateHook([file], nodeIo);
    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(lines(result.stdout)[0]).toBe(`PASS ${file}`);
  });

  it('fails the broken fixture with exit 1 and the FAIL and refs/dangling-ref lines on stderr', () => {
    const file = `${ROOT}activities/fixtures/broken-dangling-edge.json`;
    const result = runValidateHook([file], nodeIo);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    const errLines = lines(result.stderr);
    expect(errLines[0]).toBe(`FAIL ${file}`);
    expect(errLines.some((l) => l.includes('refs/dangling-ref'))).toBe(true);
  });

  it('exits 2 with the usage on stderr for no arguments', () => {
    const result = runValidateHook([], nodeIo);
    expect(result.code).toBe(2);
    expect(result.stdout).toBe('');
    expect(lines(result.stderr).some((l) => l.startsWith('usage: pnpm validate'))).toBe(true);
  });
});
