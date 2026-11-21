/**
 * Validate hook entry point (Requirements 17.2, 17.3, 17.4, design C13 H1, D18).
 *
 * Wires `runValidateHook` to the real file system (`node-io.ts`) and standard streams.
 * Sets `process.exitCode` instead of calling `process.exit`, so buffered output is
 * flushed before Node exits.
 */

import { runValidateHook } from './hook.ts';
import { nodeIo } from './node-io.ts';

const result = runValidateHook(process.argv.slice(2), nodeIo);
if (result.stdout !== '') process.stdout.write(result.stdout);
if (result.stderr !== '') process.stderr.write(result.stderr);
process.exitCode = result.code;
