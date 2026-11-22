/**
 * Boundary_Rules for dependency-cruiser (design C15, Requirements 18.3–18.5).
 *
 * Paths are matched relative to `baseDir`. A workspace import such as `@dreame/ui`
 * resolves through its symlink to `packages/ui/src/...`; a resolved `react` contains
 * `/node_modules/react/`; an unresolved name keeps its bare form. The `to.path`
 * patterns cover all three forms.
 */

import type { ICruiseOptions, IForbiddenRuleType } from 'dependency-cruiser';

const REACT = '(^|/node_modules/)(react|react-dom)(/|$)';
const UI = '^packages/ui/';
const APPS = '^apps/';
const AJV = '(^|/node_modules/)ajv(/|$)';

export const BOUNDARY_RULES: IForbiddenRuleType[] = [
  {
    name: 'runtime-no-ui-or-apps',
    comment: 'packages/runtime must not import react, react-dom, @dreame/ui or apps/ (Requirement 18.3).',
    severity: 'error',
    from: { path: '^packages/runtime/' },
    to: { path: [REACT, UI, APPS] },
  },
  {
    name: 'react-free-no-ui',
    comment: 'React-free modules must not import react, react-dom or @dreame/ui (Requirement 18.4).',
    severity: 'error',
    from: {
      path: '^(packages/node-types/(src|scripts)/|packages/schema/src/|apps/shop-challenge/src/node-types/|apps/shop-challenge/src/profile\\.ts$)',
    },
    to: { path: [REACT, UI] },
  },
  {
    name: 'packages-no-apps',
    comment: 'packages/ must not import apps/ (Requirement 18.5).',
    severity: 'error',
    from: { path: '^packages/' },
    to: { path: APPS },
  },
  {
    name: 'ajv-only-in-codegen',
    comment: 'Only packages/schema/src/codegen/ may import ajv (Requirement 18.5).',
    severity: 'error',
    from: { pathNot: '^packages/schema/src/codegen/' },
    to: { path: AJV },
  },
];

/**
 * Cruise options for the Boundary_Rules; `root` is the folder that paths are relative to.
 *
 * `exclude` is anchored to workspace folders: dependency-cruiser also drops dependencies
 * whose resolved path matches `exclude`, so an unanchored `node_modules/` or `dist/`
 * would hide resolved `react` and `ajv` edges. `doNotFollow` keeps `node_modules` out of
 * the scan. `exportsFields` lets `@dreame/*` resolve through their `exports` field
 * (dependency-cruiser's default is `[]`).
 */
export function cruiseOptions(root: string): ICruiseOptions {
  return {
    baseDir: root,
    ruleSet: { forbidden: BOUNDARY_RULES },
    validate: true,
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '^(apps|packages|tools)/[^/]+/(generated|dist|coverage)/' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'types', 'default'],
    },
  };
}
