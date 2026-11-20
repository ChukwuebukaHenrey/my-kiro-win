import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Package boundary and purity scans for Requirements 14.5 and 15.11.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const RUNTIME_DIR = join(ROOT, 'packages', 'runtime');
const PURITY_DIRS = [join(RUNTIME_DIR, 'src'), join(ROOT, 'packages', 'node-types', 'src')];

// Forbidden tokens are built from fragments so that this file does not match its own scan.
const REACT = 're' + 'act';
const APPS = 'ap' + 'ps/';
const NODE_TYPES_PKG = '@dreame/' + 'node-types';
const IMPURE: readonly { label: string; re: RegExp }[] = [
  { label: 'Da' + 'te.now', re: new RegExp('\\bDa' + 'te\\s*\\.\\s*now\\b') },
  { label: 'new Da' + 'te(', re: new RegExp('\\bnew\\s+Da' + 'te\\s*\\(') },
  { label: 'Ma' + 'th.random', re: new RegExp('\\bMa' + 'th\\s*\\.\\s*random\\b') },
];

function rel(file: string): string {
  return relative(ROOT, file).split(sep).join('/');
}

/** Lists `.ts`, `.tsx` and `.js` files under `dir`, skipping `node_modules`. */
function listSourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') out.push(...listSourceFiles(full));
    } else if (entry.isFile() && /\.(ts|tsx|js|mjs|cjs)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Every module specifier in `source`: static, side-effect and dynamic imports, and `require`. */
function moduleSpecifiers(source: string): string[] {
  const patterns = [
    /\b(?:import|export)\s[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  const specs: string[] = [];
  for (const re of patterns) {
    for (const m of source.matchAll(re)) {
      if (m[1] !== undefined) specs.push(m[1]);
    }
  }
  return specs;
}

function isForbiddenSpecifier(spec: string): boolean {
  return (
    spec === REACT ||
    spec.startsWith(REACT + '/') ||
    spec === REACT + '-dom' ||
    spec.startsWith(REACT + '-dom/') ||
    spec.includes(APPS)
  );
}

describe('runtime package boundaries', () => {
  it('the specifier check flags react, react-dom and apps/ paths and allows the rest', () => {
    for (const bad of [REACT, REACT + '-dom', REACT + '-dom/client', '../../../' + APPS + 'shop-challenge/x.ts']) {
      expect(isForbiddenSpecifier(bad)).toBe(true);
    }
    for (const ok of ['@dreame/schema', './state.ts', 'vitest', 'node:fs']) {
      expect(isForbiddenSpecifier(ok)).toBe(false);
    }
  });

  it('no file under packages/runtime imports react, react-dom or apps/ (Req 14.5)', () => {
    const files = listSourceFiles(RUNTIME_DIR);
    expect(files.length).toBeGreaterThan(0);
    const hits: string[] = [];
    for (const file of files) {
      for (const spec of moduleSpecifiers(readFileSync(file, 'utf8'))) {
        if (isForbiddenSpecifier(spec)) hits.push(`${rel(file)} imports ${spec}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('packages/runtime/package.json does not depend on @dreame/node-types (Req 14.5)', () => {
    const pkg = JSON.parse(readFileSync(join(RUNTIME_DIR, 'package.json'), 'utf8')) as Record<string, unknown>;
    const fields = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
    for (const field of fields) {
      const deps = (pkg[field] ?? {}) as Record<string, unknown>;
      expect(Object.hasOwn(deps, NODE_TYPES_PKG), `${field} lists ${NODE_TYPES_PKG}`).toBe(false);
    }
  });
});

describe('runtime purity', () => {
  it('the impurity patterns match sample code and leave safe code alone', () => {
    const samples = ['Da' + 'te.now()', 'new Da' + 'te()', 'Ma' + 'th.random()'];
    samples.forEach((sample, i) => expect(IMPURE[i]?.re.test(sample)).toBe(true));
    expect(IMPURE.some(({ re }) => re.test('const t = clock.now; rng.next(); Math.floor(x);'))).toBe(false);
  });

  it('no file under packages/runtime/src or packages/node-types/src reads the wall clock or unseeded randomness (Req 15.11)', () => {
    const files = PURITY_DIRS.flatMap(listSourceFiles);
    expect(files.length).toBeGreaterThan(0);
    const hits: string[] = [];
    for (const file of files) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          for (const { label, re } of IMPURE) {
            if (re.test(line)) hits.push(`${rel(file)}:${i + 1} ${label}`);
          }
        });
    }
    expect(hits).toEqual([]);
  });
});
