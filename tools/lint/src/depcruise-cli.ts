/**
 * depcruise CLI entry point (design C15, Requirements 18.3–18.5, 18.8).
 *
 * Cruises `apps`, `packages` and `tools` with the Boundary_Rules. On a violation it
 * writes the `err` report to stderr and sets exit code 1; on success it writes one
 * summary line to stdout. Sets `process.exitCode` instead of calling `process.exit`,
 * so buffered output is flushed before Node exits.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cruise, format } from 'dependency-cruiser';
import { cruiseOptions } from './depcruise-rules.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const result = await cruise(['apps', 'packages', 'tools'], cruiseOptions(ROOT));
const output = result.output;
if (typeof output === 'string') {
  throw new Error('dependency-cruiser returned a string; expected a cruise result object');
}

const { summary } = output;
if (summary.error > 0) {
  const report = await format(output, { outputType: 'err' });
  process.stderr.write(`${String(report.output)}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `depcruise: no boundary violations (${summary.totalCruised} modules, ${summary.totalDependenciesCruised ?? 0} dependencies cruised)\n`,
  );
}
