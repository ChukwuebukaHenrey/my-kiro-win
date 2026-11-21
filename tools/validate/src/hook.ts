/**
 * Validate hook core (Requirements 17.2, 17.3, 17.4, design C13 H1, D18).
 *
 * Kiro sends only stderr to the agent when a hook command exits non-zero, while `run`
 * prints `FAIL` and diagnostic lines through `out`. `runValidateHook` runs `run` with an
 * in-memory output buffer and routes every line by exit code: all lines to `stdout` on
 * exit 0, all lines to `stderr` on exit 1 or 2. Like `run`, it touches no `process`.
 */

import { run, type CliIo } from './run.ts';

export interface HookResult {
  readonly code: 0 | 1 | 2;
  /** All output lines in order when `code` is 0, otherwise ''. */
  readonly stdout: string;
  /** All output lines in order when `code` is 1 or 2, otherwise ''. */
  readonly stderr: string;
}

export function runValidateHook(argv: readonly string[], io: Pick<CliIo, 'readFile' | 'listFiles'>): HookResult {
  const lines: string[] = [];
  const buffered: CliIo = {
    readFile: (path: string) => io.readFile(path),
    listFiles: (dir: string) => io.listFiles(dir),
    out(line: string): void {
      lines.push(line);
    },
    err(line: string): void {
      lines.push(line);
    },
  };
  const code = run(argv, buffered);
  const text = lines.map((line) => `${line}\n`).join('');
  return code === 0 ? { code, stdout: text, stderr: '' } : { code, stdout: '', stderr: text };
}
