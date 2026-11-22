/**
 * ESLint CLI entry point (design C15, Requirements 18.6–18.8).
 *
 * Lints `apps`, `packages` and `tools` with `eslintConfig()`. When any result has an
 * error or a warning it writes the `stylish` report to stderr and sets exit code 1;
 * on success it writes one summary line to stdout. Sets `process.exitCode` instead
 * of calling `process.exit`, so buffered output is flushed before Node exits.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { eslintConfig } from './eslint-config.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const eslint = new ESLint({
  cwd: ROOT,
  overrideConfigFile: true,
  overrideConfig: eslintConfig(),
  errorOnUnmatchedPattern: true,
});

const results = await eslint.lintFiles(['apps', 'packages', 'tools']);
const failed = results.some((result) => result.errorCount > 0 || result.warningCount > 0);

if (failed) {
  const formatter = await eslint.loadFormatter('stylish');
  const report = await formatter.format(results);
  process.stderr.write(`${report}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`eslint: no problems (${results.length} files linted)\n`);
}
