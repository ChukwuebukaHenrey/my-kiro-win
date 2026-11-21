/**
 * Validate CLI entry point (Requirements 17.12, 17.13).
 *
 * Wires `run` to the real file system (`node-io.ts`) and standard streams. Sets
 * `process.exitCode` instead of calling `process.exit`, so buffered output is flushed
 * before Node exits.
 */

import { nodeIo } from './node-io.ts';
import { run, type CliIo } from './run.ts';

const io: CliIo = {
  readFile: nodeIo.readFile,
  listFiles: nodeIo.listFiles,
  out(line: string): void {
    process.stdout.write(`${line}\n`);
  },
  err(line: string): void {
    process.stderr.write(`${line}\n`);
  },
};

process.exitCode = run(process.argv.slice(2), io);
