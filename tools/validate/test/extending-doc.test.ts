import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { coreNodeTypes } from '@dreame/node-types';

// Structure check of `EXTENDING.md` (Requirements 15.8, 16.1-16.4).

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const lines = readFileSync(join(ROOT, 'EXTENDING.md'), 'utf8').split(/\r?\n/);
const ENTRY_LABELS = ['Node type', 'View', 'Tests'] as const;

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

describe('EXTENDING.md (Requirements 15.8, 16.1-16.4)', () => {
  it('starts with the title', () => {
    expect(lines[0]).toBe('# Extending DREAME');
  });

  it('has exactly one ## heading, "## Node types"', () => {
    expect(lines.filter((line) => line.startsWith('## '))).toEqual(['## Node types']);
  });

  it('has one ### section per core node type, in coreNodeTypes order', () => {
    const headings = lines.filter((line) => line.startsWith('### '));
    expect(headings).toEqual(coreNodeTypes.map((t) => `### ${t.type}`));
  });

  for (const { type } of coreNodeTypes) {
    it(`### ${type} has Node type, View and Tests lines whose paths exist`, () => {
      const section = sectionLines(type);
      for (const label of ENTRY_LABELS) {
        const entries = section.filter((line) => line.startsWith(`- ${label}: `));
        expect(entries, `${type}: ${label}`).toHaveLength(1);
        const paths = pathsIn(entries[0] ?? '');
        expect(paths.length, `${type}: ${label} paths`).toBeGreaterThan(0);
        for (const path of paths) expect(existsSync(join(ROOT, path)), path).toBe(true);
      }
    });
  }
});
