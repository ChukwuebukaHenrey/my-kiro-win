import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Package boundary and purity scans for Requirements 12.6, 14.3, 14.4, 14.5 and 15.11.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const RUNTIME_DIR = join(ROOT, 'packages', 'runtime');
const PURITY_DIRS = [join(RUNTIME_DIR, 'src'), join(ROOT, 'packages', 'node-types', 'src')];

// Forbidden tokens are built from fragments so that this file does not match its own scan.
const REACT = 're' + 'act';
const APPS = 'ap' + 'ps/';
const NODE_TYPES_PKG = '@dreame/' + 'node-types';
const UI_PKG = '@dreame/' + 'ui';
const NO_UI_DIRS = [
  join(ROOT, 'packages', 'node-types', 'src'),
  join(ROOT, 'packages', 'node-types', 'scripts'),
  join(ROOT, 'packages', 'schema', 'src'),
];
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

/** Every module specifier in `source` with its 1-based line: static, side-effect and dynamic imports, and `require`. */
function moduleSpecifiers(source: string): { spec: string; line: number }[] {
  const patterns = [
    /\b(?:import|export)\s[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  const specs: { spec: string; line: number }[] = [];
  for (const re of patterns) {
    for (const m of source.matchAll(re)) {
      if (m[1] === undefined) continue;
      const end = (m.index ?? 0) + m[0].length;
      specs.push({ spec: m[1], line: source.slice(0, end).split('\n').length });
    }
  }
  return specs;
}

/** True for `pkg` itself or a subpath `pkg/...`; `pkg-other` does not match. */
function isPackageOrSubpath(spec: string, pkg: string): boolean {
  return spec === pkg || spec.startsWith(pkg + '/');
}

/** Flags `react`, `react-dom` and `@dreame/ui`, with their subpaths. */
function isUiSpecifier(spec: string): boolean {
  return [REACT, REACT + '-dom', UI_PKG].some((pkg) => isPackageOrSubpath(spec, pkg));
}

function isForbiddenSpecifier(spec: string): boolean {
  return isUiSpecifier(spec) || spec.includes(APPS);
}

/** `file:line imports spec` for every specifier in `files` that `check` flags. */
function findImports(files: readonly string[], check: (spec: string) => boolean): string[] {
  const hits: string[] = [];
  for (const file of files) {
    for (const { spec, line } of moduleSpecifiers(readFileSync(file, 'utf8'))) {
      if (check(spec)) hits.push(`${rel(file)}:${line} imports ${spec}`);
    }
  }
  return hits;
}

describe('runtime package boundaries', () => {
  it('the specifier check flags react, react-dom, @dreame/ui and apps/ paths and allows the rest', () => {
    for (const bad of [
      REACT,
      REACT + '/jsx-runtime',
      REACT + '-dom',
      REACT + '-dom/client',
      UI_PKG,
      UI_PKG + '/theme.css',
      '../../../' + APPS + 'shop-challenge/x.ts',
    ]) {
      expect(isForbiddenSpecifier(bad), bad).toBe(true);
    }
    for (const ok of ['@dreame/schema', './state.ts', 'vitest', 'node:fs', REACT + '-something', UI_PKG + '-kit']) {
      expect(isForbiddenSpecifier(ok), ok).toBe(false);
    }
  });

  it('no file under packages/runtime imports react, react-dom, @dreame/ui or apps/ (Req 14.3, 14.5)', () => {
    const files = listSourceFiles(RUNTIME_DIR);
    expect(files.length).toBeGreaterThan(0);
    expect(findImports(files, isForbiddenSpecifier)).toEqual([]);
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

describe('node-types and schema stay free of UI code', () => {
  for (const dir of NO_UI_DIRS) {
    it(`no file under ${rel(dir)} imports react, react-dom or @dreame/ui (Req 12.6, 14.4)`, () => {
      const files = listSourceFiles(dir);
      expect(files.length).toBeGreaterThan(0);
      expect(findImports(files, isUiSpecifier)).toEqual([]);
    });
  }
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
