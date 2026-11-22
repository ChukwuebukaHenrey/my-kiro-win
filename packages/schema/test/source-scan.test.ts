import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Source scans for security.md and runtime-core Requirements 4.1, 4.8, 6.5, 14.6 and 14.7,
// extended to apps/ by shop-challenge Requirements 4.6 and 14.3.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SCHEMA_INDEX = join(ROOT, 'packages', 'schema', 'src', 'index.ts');
const CODEGEN_DIR = join(ROOT, 'packages', 'schema', 'src', 'codegen');
// `dist` holds build output, such as a Vite bundle of an app, which is not source.
const SKIPPED_DIRS = new Set(['node_modules', 'dist', 'generated']);
const SCANNED_TOPS = ['apps', 'packages', 'tools'] as const;

// Forbidden tokens are built from fragments so that this file does not match its own scan.
const EV = 'ev' + 'al';
const FN = 'Func' + 'tion';
const INNER = 'inner' + 'HTML';
const DANGEROUS = 'dangerously' + 'Set' + 'Inner' + 'HTML';

const FORBIDDEN: readonly { label: string; re: RegExp }[] = [
  { label: EV + '(', re: new RegExp('\\b' + EV + '\\s*\\(') },
  { label: 'new ' + FN, re: new RegExp('\\bnew\\s+' + FN + '\\b') },
  { label: INNER, re: new RegExp('\\b' + INNER + '\\b') },
  { label: DANGEROUS, re: new RegExp('\\b' + DANGEROUS + '\\b') },
];

function rel(file: string): string {
  return relative(ROOT, file).split(sep).join('/');
}

/** Lists `.ts`, `.tsx`, `.js` and `.jsx` files under `dir`, skipping `node_modules`, `dist` and `generated` folders. */
function listSourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) out.push(...listSourceFiles(full));
    } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Lists the `src` folders of every workspace folder directly under `apps/`, `packages/` and `tools/`. */
function listSrcDirs(): string[] {
  const dirs: string[] = [];
  for (const top of SCANNED_TOPS) {
    const base = join(ROOT, top);
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      const src = join(base, entry.name, 'src');
      if (entry.isDirectory() && existsSync(src)) dirs.push(src);
    }
  }
  return dirs;
}

/**
 * Returns every module specifier in `source`: static `import`/`export ... from`, side-effect
 * imports, dynamic `import(...)` and `require(...)`. Matches inside strings and comments are
 * included, which can only add specifiers, never hide one.
 */
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

function isAjv(spec: string): boolean {
  return spec === 'ajv' || spec.startsWith('ajv/');
}

function importsAjv(file: string): boolean {
  return moduleSpecifiers(readFileSync(file, 'utf8')).some(isAjv);
}

describe('source scan', () => {
  it('the forbidden patterns match sample code and leave safe code alone', () => {
    const samples = [EV + '("1")', 'new ' + FN + '("x")', 'el.' + INNER + ' = s', '<div ' + DANGEROUS + '={x} />'];
    samples.forEach((sample, i) => expect(FORBIDDEN[i]?.re.test(sample)).toBe(true));
    const safe = 'const evaluate = () => 1; function f() {} el.textContent = s;';
    expect(FORBIDDEN.some(({ re }) => re.test(safe))).toBe(false);
  });

  it('(a) no .ts, .tsx, .js or .jsx file under apps/, packages/ or tools/ calls the forbidden APIs (Req 14.7; shop-challenge Req 14.3)', () => {
    const files = SCANNED_TOPS.flatMap((top) => listSourceFiles(join(ROOT, top)));
    expect(files.length).toBeGreaterThan(0);
    // The scan must reach the React components, or the check below would skip them.
    const relFiles = files.map(rel);
    expect(relFiles.some((f) => f.startsWith('packages/ui/src/') && f.endsWith('.tsx'))).toBe(true);
    expect(relFiles.some((f) => f.startsWith('apps/shop-challenge/src/') && f.endsWith('.tsx'))).toBe(true);
    const hits: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        for (const { label, re } of FORBIDDEN) {
          if (re.test(line)) hits.push(`${rel(file)}:${i + 1} ${label}`);
        }
      });
    }
    expect(hits).toEqual([]);
  });

  it('(b) following relative imports from packages/schema/src/index.ts never reaches ajv (Req 4.1, 6.5, 14.6)', () => {
    const visited = new Set<string>();
    const missing: string[] = [];
    const ajvFiles: string[] = [];
    const queue = [SCHEMA_INDEX];
    while (queue.length > 0) {
      const file = queue.pop() as string;
      if (visited.has(file)) continue;
      visited.add(file);
      if (!existsSync(file)) {
        missing.push(rel(file));
        continue;
      }
      const specs = moduleSpecifiers(readFileSync(file, 'utf8'));
      if (specs.some(isAjv)) ajvFiles.push(rel(file));
      for (const spec of specs) {
        if (spec.startsWith('./') || spec.startsWith('../')) queue.push(resolve(dirname(file), spec));
      }
    }
    expect(missing).toEqual([]);
    expect(ajvFiles).toEqual([]);
    const reached = [...visited].map(rel).sort();
    for (const name of ['ids', 'contracts', 'diagnostics', 'node-type', 'compose', 'parse', 'url']) {
      expect(reached).toContain(`packages/schema/src/${name}.ts`);
    }
    expect(reached.some((f) => f.startsWith('packages/schema/src/codegen/'))).toBe(false);
  });

  it('(c) among apps/*/src, packages/*/src and tools/*/src, only packages/schema/src/codegen/ imports ajv (Req 4.1, 4.8; shop-challenge Req 4.6)', () => {
    const srcDirs = listSrcDirs();
    // The scan must reach the app sources, or the check below would skip them.
    expect(srcDirs.map(rel)).toContain('apps/shop-challenge/src');
    const files = srcDirs.flatMap(listSourceFiles);
    const importers = files.filter(importsAjv);
    const outside = importers.filter((f) => !f.startsWith(CODEGEN_DIR + sep));
    expect(outside.map(rel)).toEqual([]);
    // The detector must find the codegen import, or the check above would pass vacuously.
    expect(importers.map(rel)).toContain('packages/schema/src/codegen/index.ts');
  });
});
