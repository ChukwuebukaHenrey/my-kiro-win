import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { coreNodeTypes } from '@dreame/node-types';
import { shopNodeTypes } from '@dreame/shop-challenge/node-types';
import { practiceNodeTypes } from '@dreame/practice-path/node-types';

// Structure check of `EXTENDING.md` (Requirements 15.8, 16.1-16.4; shop-challenge 19.4, 19.5;
// practice-path 23.4, 23.5).

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const lines = readFileSync(join(ROOT, 'EXTENDING.md'), 'utf8').split(/\r?\n/);
const ENTRY_LABELS = ['Node type', 'View', 'Tests'] as const;

const coreTypes = coreNodeTypes.map((t) => t.type);

/** The node types of `nodeTypes` that are not core types, in profile order. */
function nonCoreTypes(nodeTypes: readonly { type: string }[]): string[] {
  return nodeTypes.map((t) => t.type).filter((type) => !coreTypes.includes(type));
}

/** Each app with its non-core node types, in the order its sections appear in `EXTENDING.md`. */
const APPS: readonly { app: string; types: readonly string[] }[] = [
  { app: 'shop-challenge', types: nonCoreTypes(shopNodeTypes) },
  { app: 'practice-path', types: nonCoreTypes(practiceNodeTypes) },
];

/** The lines from `### <type>` up to the next heading. */
function sectionLines(type: string): string[] {
  const start = lines.indexOf(`### ${type}`);
  if (start === -1) return [];
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith('#'));
  return end === -1 ? rest : rest.slice(0, end);
}

/** Backtick-quoted values that look like repository paths. */
function pathsIn(line: string): string[] {
  return [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1] ?? '').filter((v) => v.includes('/'));
}

/** The single `- <label>: ` line of a section. */
function entryLine(type: string, label: (typeof ENTRY_LABELS)[number]): string {
  const entries = sectionLines(type).filter((line) => line.startsWith(`- ${label}: `));
  expect(entries, `${type}: ${label}`).toHaveLength(1);
  return entries[0] ?? '';
}

/** Checks that a line lists at least one path and that every listed path exists. */
function expectPathsExist(type: string, label: string, line: string): void {
  const paths = pathsIn(line);
  expect(paths.length, `${type}: ${label} paths`).toBeGreaterThan(0);
  for (const path of paths) expect(existsSync(join(ROOT, path)), path).toBe(true);
}

/** (`shop-challenge`, `collectionSelect`) -> `apps/shop-challenge/src/views/CollectionSelectNodeView.tsx`. */
function appViewPath(app: string, type: string): string {
  return `apps/${app}/src/views/${type.charAt(0).toUpperCase()}${type.slice(1)}NodeView.tsx`;
}

describe('EXTENDING.md (Requirements 15.8, 16.1-16.4, 19.4, 19.5, 23.4, 23.5)', () => {
  it('starts with the title', () => {
    expect(lines[0]).toBe('# Extending DREAME');
  });

  it('has exactly one ## heading, "## Node types"', () => {
    expect(lines.filter((line) => line.startsWith('## '))).toEqual(['## Node types']);
  });

  it('has one ### section per core node type, then per shop-challenge and practice-path app node type', () => {
    const headings = lines.filter((line) => line.startsWith('### '));
    const expected = [...coreTypes, ...APPS.flatMap(({ types }) => types)];
    expect(headings).toEqual(expected.map((type) => `### ${type}`));
  });

  for (const type of coreTypes) {
    it(`### ${type} has Node type, View and Tests lines whose paths exist`, () => {
      for (const label of ENTRY_LABELS) expectPathsExist(type, label, entryLine(type, label));
    });
  }

  for (const { app, types } of APPS) {
    for (const type of types) {
      it(`### ${type} (${app}) has Node type and Tests lines whose paths exist, and a View line matching the view file`, () => {
        expectPathsExist(type, 'Node type', entryLine(type, 'Node type'));
        expectPathsExist(type, 'Tests', entryLine(type, 'Tests'));
        const view = entryLine(type, 'View');
        const viewPath = appViewPath(app, type);
        if (existsSync(join(ROOT, viewPath))) {
          expect(pathsIn(view), `${type}: View`).toEqual([viewPath]);
        } else {
          expect(view, `${type}: View`).toBe('- View: not written yet');
        }
      });
    }
  }
});
