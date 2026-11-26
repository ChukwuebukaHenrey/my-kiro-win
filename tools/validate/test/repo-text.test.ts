import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Repository text scan for Requirements 1.14 and 18.7 (ui-renderer) and 14.7
// (shop-challenge). The phrases are read from
// `.kiro/steering/product.md` at run time, so this file never spells them out.

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const STEERING_FILE = join(ROOT, '.kiro', 'steering', 'product.md');
const EXPECTED_PHRASE_COUNT = 8;

/** The quoted phrases of the "Do not use" line in the product steering file. */
function readBannedPhrases(): string[] {
  const lines = readFileSync(STEERING_FILE, 'utf8').split(/\r?\n/);
  const rule = lines.filter((line) => line.startsWith('- Do not use "'));
  if (rule.length !== 1) {
    throw new Error(`expected one "Do not use" line in ${STEERING_FILE}, found ${rule.length}`);
  }
  return [...(rule[0] ?? '').matchAll(/"([^"]+)"/g)].map((m) => m[1] ?? '');
}

/** Every file under `dir`, recursively. */
function listFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...listFilesRecursive(path));
    else out.push(path);
  }
  return out;
}

/** Files in `dir` whose names end with `suffix`; none when `dir` does not exist. */
function listFilesWithSuffix(dir: string, suffix: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(suffix))
    .map((name) => join(dir, name))
    .filter((path) => statSync(path).isFile());
}

/** `line:phrase` for each case-insensitive substring match in `text`. */
function findHits(text: string, phrases: readonly string[]): string[] {
  const hits: string[] = [];
  text.split(/\r?\n/).forEach((line, index) => {
    const lower = line.toLowerCase();
    for (const phrase of phrases) {
      if (lower.includes(phrase.toLowerCase())) hits.push(`${index + 1}: ${phrase}`);
    }
  });
  return hits;
}

/** Hits across `files`, as `<repo-relative path>:<line>: <phrase>`. */
function scanFiles(files: readonly string[], phrases: readonly string[]): string[] {
  return files.flatMap((file) =>
    findHits(readFileSync(file, 'utf8'), phrases).map(
      (hit) => `${relative(ROOT, file).split('\\').join('/')}:${hit}`,
    ),
  );
}

const phrases = readBannedPhrases();

describe('banned phrase list', () => {
  it(`reads ${EXPECTED_PHRASE_COUNT} quoted phrases from .kiro/steering/product.md`, () => {
    expect(phrases).toHaveLength(EXPECTED_PHRASE_COUNT);
    for (const phrase of phrases) expect(phrase.trim()).not.toBe('');
  });

  it('matches a phrase as a case-insensitive substring and reports its line', () => {
    const phrase = phrases[0] ?? '';
    expect(findHits(`first line\nsee ${phrase.toUpperCase()} here`, phrases)).toEqual([`2: ${phrase}`]);
    expect(findHits('nothing to see', phrases)).toEqual([]);
  });
});

describe('repository text (Requirements 1.14, 18.7)', () => {
  it('KIRO_LOG.md has no banned phrase', () => {
    expect(scanFiles([join(ROOT, 'KIRO_LOG.md')], phrases)).toEqual([]);
  });

  it('.kiro/specs/ui-renderer/*.md has no banned phrase', () => {
    const files = listFilesWithSuffix(join(ROOT, '.kiro', 'specs', 'ui-renderer'), '.md');
    expect(files.length).toBeGreaterThan(0);
    expect(scanFiles(files, phrases)).toEqual([]);
  });

  it('packages/ui/src has no banned phrase', () => {
    const files = listFilesRecursive(join(ROOT, 'packages', 'ui', 'src'));
    expect(files.length).toBeGreaterThan(0);
    expect(scanFiles(files, phrases)).toEqual([]);
  });

  it('EXTENDING.md has no banned phrase when it exists', () => {
    const file = join(ROOT, 'EXTENDING.md');
    expect(scanFiles(existsSync(file) ? [file] : [], phrases)).toEqual([]);
  });

  it('.kiro/hooks/*.json has no banned phrase when the files exist', () => {
    expect(scanFiles(listFilesWithSuffix(join(ROOT, '.kiro', 'hooks'), '.json'), phrases)).toEqual([]);
  });
});

describe('shop-challenge repository text (Requirement 14.7)', () => {
  it('.kiro/specs/shop-challenge/*.md has no banned phrase', () => {
    const files = listFilesWithSuffix(join(ROOT, '.kiro', 'specs', 'shop-challenge'), '.md');
    expect(files.length).toBeGreaterThan(0);
    expect(scanFiles(files, phrases)).toEqual([]);
  });

  it('apps/shop-challenge/src has no banned phrase', () => {
    const files = listFilesRecursive(join(ROOT, 'apps', 'shop-challenge', 'src'));
    expect(files.length).toBeGreaterThan(0);
    expect(scanFiles(files, phrases)).toEqual([]);
  });

  it('apps/shop-challenge/index.html has no banned phrase', () => {
    expect(scanFiles([join(ROOT, 'apps', 'shop-challenge', 'index.html')], phrases)).toEqual([]);
  });

  it('apps/shop-challenge/README.md has no banned phrase', () => {
    expect(scanFiles([join(ROOT, 'apps', 'shop-challenge', 'README.md')], phrases)).toEqual([]);
  });

  it('PRIVACY.md has no banned phrase', () => {
    expect(scanFiles([join(ROOT, 'PRIVACY.md')], phrases)).toEqual([]);
  });
});

describe('practice-path repository text (Requirement 19.10)', () => {
  it('.kiro/specs/practice-path/*.md has no banned phrase', () => {
    const files = listFilesWithSuffix(join(ROOT, '.kiro', 'specs', 'practice-path'), '.md');
    expect(files.length).toBeGreaterThan(0);
    expect(scanFiles(files, phrases)).toEqual([]);
  });

  it('apps/practice-path/src has no banned phrase', () => {
    const files = listFilesRecursive(join(ROOT, 'apps', 'practice-path', 'src'));
    expect(files.length).toBeGreaterThan(0);
    expect(scanFiles(files, phrases)).toEqual([]);
  });

  it('apps/practice-path/index.html has no banned phrase', () => {
    expect(scanFiles([join(ROOT, 'apps', 'practice-path', 'index.html')], phrases)).toEqual([]);
  });

  it('apps/practice-path/README.md has no banned phrase', () => {
    expect(scanFiles([join(ROOT, 'apps', 'practice-path', 'README.md')], phrases)).toEqual([]);
  });

  it('packages/storage/README.md has no banned phrase', () => {
    expect(scanFiles([join(ROOT, 'packages', 'storage', 'README.md')], phrases)).toEqual([]);
  });
});
