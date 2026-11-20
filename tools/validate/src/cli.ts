/**
 * Validate CLI entry point (Requirements 17.12, 17.13).
 *
 * Wires `run` to the real file system and standard streams. Sets `process.exitCode`
 * instead of calling `process.exit`, so buffered output is flushed before Node exits.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { run, type CliIo } from './run.ts';

const io: CliIo = {
  readFile(path: string): Uint8Array | null {
    try {
      return readFileSync(path);
    } catch {
      return null;
    }
  },
  listFiles(dir: string): string[] | null {
    try {
      return readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name);
    } catch {
      return null;
    }
  },
  out(line: string): void {
    process.stdout.write(`${line}\n`);
  },
  err(line: string): void {
    process.stderr.write(`${line}\n`);
  },
};

process.exitCode = run(process.argv.slice(2), io);
