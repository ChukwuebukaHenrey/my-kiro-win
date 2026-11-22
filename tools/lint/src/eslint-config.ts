/**
 * ESLint flat config for the Lint_Check (design C15, Requirements 18.6, 18.7).
 *
 * Passed to the ESLint Node API by `eslint-cli.ts`, so no config file lookup is
 * involved. The parser runs without `parserOptions.project`, so no type information
 * is loaded.
 */

import type { Linter } from 'eslint';
import react from 'eslint-plugin-react';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import tseslint from 'typescript-eslint';

export const LINT_IGNORES = [
  '**/node_modules/**',
  '**/generated/**',
  '**/dist/**',
  '**/coverage/**',
  'design-refs/**',
];

/** Raises a `warn` (or `1`) level to `error` (or `2`); `off` stays `off`. */
function raiseSeverity(severity: Linter.RuleSeverity): Linter.RuleSeverity {
  if (severity === 'warn') return 'error';
  if (severity === 1) return 2;
  return severity;
}

/**
 * Returns a copy of `rules` in which every `warn` level is raised to `error`.
 * Each rule keeps its options; a rule that is `off` stays `off`.
 */
export function asErrors(rules: Linter.RulesRecord): Linter.RulesRecord {
  const raised: Linter.RulesRecord = {};
  for (const [name, entry] of Object.entries(rules)) {
    if (entry === undefined) continue;
    if (Array.isArray(entry)) {
      const [severity, ...options] = entry;
      raised[name] = [raiseSeverity(severity), ...options];
    } else {
      raised[name] = raiseSeverity(entry);
    }
  }
  return raised;
}

export function eslintConfig(): Linter.Config[] {
  return [
    { ignores: LINT_IGNORES },
    {
      files: ['apps/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}', 'tools/**/*.{ts,tsx}'],
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' },
      },
      plugins: { react },
      settings: { react: { version: '19.3' } },
      rules: { 'react/no-danger': 'error' },
    },
    {
      files: ['apps/**/*.tsx', 'packages/ui/**/*.tsx'],
      plugins: { 'jsx-a11y': jsxA11y },
      rules: asErrors(jsxA11y.flatConfigs.recommended.rules),
    },
  ];
}
