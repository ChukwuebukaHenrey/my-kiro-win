import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Privacy scan for Requirement 7.6 (design C12): no file under packages/ui/src sends data off the
// device, uses browser storage directly, or renders an input other than a radio button.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const UI_SRC = join(ROOT, 'packages', 'ui', 'src');

// Searched tokens are built from fragments so that this file does not match its own scan.
const FETCH = 'fet' + 'ch';
const XHR = 'XMLHttp' + 'Request';
const BEACON = 'send' + 'Beacon';
const SOCKET = 'Web' + 'Socket';
const STORAGE = 'local' + 'Storage';
const INPUT = 'inp' + 'ut';

const FORBIDDEN: readonly { label: string; re: RegExp }[] = [
  { label: FETCH + '(', re: new RegExp('\\b' + FETCH + '\\s*\\(') },
  { label: XHR, re: new RegExp('\\b' + XHR + '\\b') },
  { label: BEACON, re: new RegExp('\\b' + BEACON + '\\b') },
  { label: SOCKET, re: new RegExp('\\b' + SOCKET + '\\b') },
  { label: STORAGE, re: new RegExp('\\b' + STORAGE + '\\b') },
];

// An input tag runs from its opening `<` to the first `>` that is not part of an arrow `=>`.
const INPUT_TAG = new RegExp('<' + INPUT + '\\b(?:=>|[^>])*>', 'g');
const RADIO_TYPE = /\btype\s*=\s*(?:"radio"|'radio'|\{\s*['"]radio['"]\s*\})/;

function rel(file: string): string {
  return relative(ROOT, file).split(sep).join('/');
}

/** Lists every file under `dir`, recursively. */
function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

/** Returns `line label` for every forbidden token and every non-radio input tag in `source`. */
function scan(source: string): string[] {
  const hits: string[] = [];
  source.split('\n').forEach((line, i) => {
    for (const { label, re } of FORBIDDEN) {
      if (re.test(line)) hits.push(`${i + 1} ${label}`);
    }
  });
  for (const m of source.matchAll(INPUT_TAG)) {
    if (!RADIO_TYPE.test(m[0])) hits.push(`${lineOf(source, m.index)} <${INPUT} without type radio`);
  }
  return hits;
}

describe('privacy scan (Req 7.6)', () => {
  it('the patterns match sample code and leave safe code alone', () => {
    const samples = [
      FETCH + '("https://example.com")',
      'new ' + XHR + '()',
      'navigator.' + BEACON + '(u, d)',
      'new ' + SOCKET + '(u)',
      'window.' + STORAGE + '.setItem(k, v)',
      '<' + INPUT + ' name="n" />',
      '<' + INPUT + ' type="text" />',
      '<' + INPUT + '\n  onChange={() => go()}\n  type="email"\n/>',
    ];
    for (const sample of samples) expect(scan(sample)).not.toEqual([]);
    const safe = [
      'const prefetched = 1; el.textContent = s;',
      '<' + INPUT + ' type="radio" name="g" />',
      '<' + INPUT + '\n  onChange={() => go()}\n  type="radio"\n/>',
    ];
    for (const sample of safe) expect(scan(sample)).toEqual([]);
  });

  it('no file under packages/ui/src sends data, uses browser storage or renders a non-radio input', () => {
    const files = listFiles(UI_SRC);
    expect(files.map(rel).some((f) => f.endsWith('.tsx'))).toBe(true);
    // The tag pattern must find the radio inputs in ChoiceNodeView, or the input check would pass vacuously.
    const choiceView = readFileSync(join(UI_SRC, 'views', 'ChoiceNodeView.tsx'), 'utf8');
    expect([...choiceView.matchAll(INPUT_TAG)].length).toBeGreaterThan(0);
    const hits = files.flatMap((file) => scan(readFileSync(file, 'utf8')).map((hit) => `${rel(file)}:${hit}`));
    expect(hits).toEqual([]);
  });
});
