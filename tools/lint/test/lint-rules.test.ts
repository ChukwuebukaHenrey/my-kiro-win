import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cruise } from 'dependency-cruiser';
import { ESLint } from 'eslint';
import { afterAll, describe, expect, it } from 'vitest';
import { cruiseOptions } from '../src/depcruise-rules.ts';
import { eslintConfig } from '../src/eslint-config.ts';

// Rule test for the Lint_Check and the Boundary_Rules (design C15, Requirement 18.9).
// The violating samples exist only in memory or in a temp folder outside the repository.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SAMPLE_PATH = join(ROOT, 'packages', 'ui', 'src', 'Sample.tsx');
const TIMEOUT = 60_000;

// The raw-HTML prop name is built from fragments so that this file does not match the source scan.
const RAW_HTML_PROP = 'danger' + 'ously' + 'SetInner' + 'HTML';

async function lint(sample: string): Promise<ESLint.LintResult[]> {
  const eslint = new ESLint({ cwd: ROOT, overrideConfigFile: true, overrideConfig: eslintConfig() });
  return eslint.lintText(sample, { filePath: SAMPLE_PATH });
}

function messages(results: ESLint.LintResult[]): { ruleId: string | null; severity: number }[] {
  return results.flatMap((result) => result.messages.map(({ ruleId, severity }) => ({ ruleId, severity })));
}

describe('ESLint rules', () => {
  it(
    'reports react/no-danger at severity 2 for the raw-HTML prop',
    async () => {
      const sample = `export const A = (p: { h: string }) => <div ${RAW_HTML_PROP}={{ __html: p.h }} />;\n`;
      expect(messages(await lint(sample))).toContainEqual({ ruleId: 'react/no-danger', severity: 2 });
    },
    TIMEOUT,
  );

  it(
    'reports jsx-a11y/alt-text at severity 2 for an img without alt',
    async () => {
      const sample = 'export const A = () => <img src="x.png" />;\n';
      expect(messages(await lint(sample))).toContainEqual({ ruleId: 'jsx-a11y/alt-text', severity: 2 });
    },
    TIMEOUT,
  );

  it(
    'reports nothing for a clean sample',
    async () => {
      const sample = 'export const A = () => <img src="x.png" alt="" />;\n';
      const results = await lint(sample);
      // The sample path must be linted, not ignored, or the empty result would say nothing.
      expect(results).toHaveLength(1);
      expect(messages(results)).toEqual([]);
    },
    TIMEOUT,
  );
});

describe('dependency-cruiser Boundary_Rules', () => {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'dreame-depcruise-'));

  afterAll(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it(
    'reports one runtime-no-ui-or-apps violation for packages/runtime importing react',
    async () => {
      const srcDir = join(tmpRoot, 'packages', 'runtime', 'src');
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, 'sample.ts'), "import { useState } from 'react';\nexport const x = useState;\n", 'utf8');

      const result = await cruise(['packages'], cruiseOptions(tmpRoot));
      const output = result.output;
      if (typeof output === 'string') throw new Error('expected a cruise result object');

      expect(output.summary.totalCruised).toBeGreaterThan(0);
      const violations = output.summary.violations.map((v) => ({ from: v.from, rule: v.rule.name }));
      expect(violations).toEqual([{ from: 'packages/runtime/src/sample.ts', rule: 'runtime-no-ui-or-apps' }]);
    },
    TIMEOUT,
  );

  // practice-path Requirements 11.1, 11.2, 19.8 (design C16, D66). Each case uses its own root
  // inside the temp folder so that the samples of one case do not reach another.
  it(
    'reports react-free-no-ui and storage-no-imports for packages/storage importing react',
    async () => {
      const root = join(tmpRoot, 'storage-case');
      const srcDir = join(root, 'packages', 'storage', 'src');
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, 'sample.ts'), "import { useState } from 'react';\nexport const x = useState;\n", 'utf8');

      const result = await cruise(['packages'], cruiseOptions(root));
      const output = result.output;
      if (typeof output === 'string') throw new Error('expected a cruise result object');

      expect(output.summary.totalCruised).toBeGreaterThan(0);
      const violations = output.summary.violations
        .map((v) => ({ from: v.from, rule: v.rule.name }))
        .sort((a, b) => a.rule.localeCompare(b.rule));
      expect(violations).toEqual([
        { from: 'packages/storage/src/sample.ts', rule: 'react-free-no-ui' },
        { from: 'packages/storage/src/sample.ts', rule: 'storage-no-imports' },
      ]);
    },
    TIMEOUT,
  );

  // practice-path Requirement 3.5 (design C16, D66).
  it(
    'reports apps-no-sibling-apps for apps/practice-path importing apps/shop-challenge',
    async () => {
      const root = join(tmpRoot, 'apps-case');
      const practiceDir = join(root, 'apps', 'practice-path', 'src');
      const shopDir = join(root, 'apps', 'shop-challenge', 'src');
      mkdirSync(practiceDir, { recursive: true });
      mkdirSync(shopDir, { recursive: true });
      writeFileSync(join(shopDir, 'format.ts'), 'export const format = (n: number): string => String(n);\n', 'utf8');
      writeFileSync(
        join(practiceDir, 'sample.ts'),
        "import { format } from '../../shop-challenge/src/format.ts';\nexport const x = format;\n",
        'utf8',
      );

      const result = await cruise(['apps'], cruiseOptions(root));
      const output = result.output;
      if (typeof output === 'string') throw new Error('expected a cruise result object');

      expect(output.summary.totalCruised).toBeGreaterThan(0);
      const violations = output.summary.violations.map((v) => ({ from: v.from, to: v.to, rule: v.rule.name }));
      expect(violations).toEqual([
        { from: 'apps/practice-path/src/sample.ts', to: 'apps/shop-challenge/src/format.ts', rule: 'apps-no-sibling-apps' },
      ]);
    },
    TIMEOUT,
  );
});
