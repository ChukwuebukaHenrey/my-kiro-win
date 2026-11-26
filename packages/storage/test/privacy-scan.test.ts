import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Privacy scan for Requirements 11.2, 19.2 and 19.3 (design C16): packages/storage/src makes no
// network call, uses no other browser storage and imports no UI or app code; across the source
// trees, only packages/storage/src/index.ts names the browser storage global.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const STORAGE_SRC = join(ROOT, 'packages', 'storage', 'src');
const SOURCE_PARENTS = ['apps', 'packages', 'tools'];

// Searched tokens are built from fragments so that this file does not match its own scan.
const FETCH = 'fet' + 'ch';
const XHR = 'XMLHttp' + 'Request';
const BEACON = 'send' + 'Beacon';
const SOCKET = 'Web' + 'Socket';
const LOCAL = 'local' + 'Storage';
const SESSION = 'session' + 'Storage';
const IDB = 'indexed' + 'DB';
const REACT = 'rea' + 'ct';
const UI = '@dreame/' + 'ui';
const APPS = 'ap' + 'ps/';

const FORBIDDEN: readonly { label: string; re: RegExp }[] = [
  { label: FETCH + '(', re: new RegExp('\\b' + FETCH + '\\s*\\(') },
  { label: XHR, re: new RegExp('\\b' + XHR + '\\b') },
  { label: BEACON, re: new RegExp('\\b' + BEACON + '\\b') },
  { label: SOCKET, re: new RegExp('\\b' + SOCKET + '\\b') },
  { label: SESSION, re: new RegExp('\\b' + SESSION + '\\b') },
  { label: IDB, re: new RegExp('\\b' + IDB + '\\b') },
];
const LOCAL_RE = new RegExp('\\b' + LOCAL + '\\b');

// `from '…'`, `import '…'`, `import('…')` and `export … from '…'`.
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g;

function isForbiddenImport(spec: string): boolean {
  const pkg = (name: string): boolean => spec === name || spec.startsWith(name + '/');
  return pkg(REACT) || pkg(REACT + '-dom') || pkg(UI) || spec.includes(APPS);
}

function rel(file: string): string {
  return relative(ROOT, file).split(sep).join('/');
}

/** Lists every file under `dir`, recursively, skipping node_modules. */
function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

/** Returns `line label` for every finding in a storage source file. */
function scanStorage(source: string): string[] {
  const hits: string[] = [];
  source.split('\n').forEach((line, i) => {
    for (const { label, re } of FORBIDDEN) {
      if (re.test(line)) hits.push(`${i + 1} ${label}`);
    }
    for (const m of line.matchAll(SPECIFIER)) {
      const spec = m[1];
      if (spec !== undefined && isForbiddenImport(spec)) hits.push(`${i + 1} import ${spec}`);
    }
  });
  return hits;
}

/** Every `.ts` and `.tsx` file in `apps/*\/src`, `packages/*\/src` and `tools/*\/src`. */
function sourceFiles(): string[] {
  const out: string[] = [];
  for (const parent of SOURCE_PARENTS) {
    const parentDir = join(ROOT, parent);
    if (!existsSync(parentDir)) continue;
    for (const entry of readdirSync(parentDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      out.push(...listFiles(join(parentDir, entry.name, 'src')).filter((f) => /\.tsx?$/.test(f)));
    }
  }
  return out;
}

describe('storage privacy scan (Req 11.2, 19.2, 19.3)', () => {
  it('the patterns match sample code and leave safe code alone', () => {
    const samples = [
      FETCH + "('x')",
      'new ' + XHR + '()',
      'navigator.' + BEACON + '(u, d)',
      'new ' + SOCKET + '(u)',
      SESSION + '.getItem(k)',
      'window.' + IDB + '.open("db")',
      "import { useState } from '" + REACT + "';",
      "import { createRoot } from '" + REACT + "-dom/client';",
      "import { Button } from '" + UI + "';",
      "import x from '../../../" + APPS + "practice-path/src/profile.ts';",
      "const m = await import('" + REACT + "');",
    ];
    for (const sample of samples) expect(scanStorage(sample), sample).not.toEqual([]);
    const safe = [
      "import { x } from './helpers.ts';",
      "import type { Y } from '@dreame/schema';",
      'const prefetched = 1; const reactive = true;',
    ];
    for (const sample of safe) expect(scanStorage(sample), sample).toEqual([]);
    expect(LOCAL_RE.test('window.' + LOCAL + '.getItem(k)')).toBe(true);
    expect(LOCAL_RE.test('my' + LOCAL)).toBe(false);
  });

  it('no file under packages/storage/src makes a network call, uses other storage or imports UI or app code', () => {
    const files = listFiles(STORAGE_SRC);
    expect(files.map(rel)).toContain('packages/storage/src/index.ts');
    const hits = files.flatMap((file) => scanStorage(readFileSync(file, 'utf8')).map((hit) => `${rel(file)}:${hit}`));
    expect(hits).toEqual([]);
  });

  it('only packages/storage/src/index.ts names the browser storage global', () => {
    const files = sourceFiles();
    const scanned = files.map(rel);
    expect(scanned.some((f) => f.startsWith('apps/practice-path/src/'))).toBe(true);
    expect(scanned.some((f) => f.startsWith('packages/storage/src/'))).toBe(true);
    const naming = files.filter((file) => LOCAL_RE.test(readFileSync(file, 'utf8'))).map(rel);
    expect(naming).toEqual(['packages/storage/src/index.ts']);
  });
});
