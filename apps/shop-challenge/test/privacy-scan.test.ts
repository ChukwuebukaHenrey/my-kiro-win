import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Privacy scan for Requirements 14.1, 14.2, 14.4, 14.5 and 14.8 (design C13): no file under
// apps/shop-challenge/src sends data off the device, uses browser storage, renders a form field
// other than a checkbox, sets an inline style attribute, or renders an anchor without an https
// href, target="_blank" and rel="noopener noreferrer".

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const APP_SRC = join(ROOT, 'apps', 'shop-challenge', 'src');

// Searched tokens are built from fragments so that this file does not match its own scan.
const FETCH = 'fet' + 'ch';
const XHR = 'XMLHttp' + 'Request';
const BEACON = 'send' + 'Beacon';
const SOCKET = 'Web' + 'Socket';
const LOCAL = 'local' + 'Storage';
const SESSION = 'session' + 'Storage';
const IDB = 'indexed' + 'DB';
const INPUT = 'inp' + 'ut';
const TEXTAREA = 'text' + 'area';
const SELECT = 'sel' + 'ect';
const STYLE = 'sty' + 'le';
const HTTPS = 'htt' + 'ps://';

const FORBIDDEN: readonly { label: string; re: RegExp }[] = [
  { label: FETCH + '(', re: new RegExp('\\b' + FETCH + '\\s*\\(') },
  { label: XHR, re: new RegExp('\\b' + XHR + '\\b') },
  { label: BEACON, re: new RegExp('\\b' + BEACON + '\\b') },
  { label: SOCKET, re: new RegExp('\\b' + SOCKET + '\\b') },
  { label: LOCAL, re: new RegExp('\\b' + LOCAL + '\\b') },
  { label: SESSION, re: new RegExp('\\b' + SESSION + '\\b') },
  { label: IDB, re: new RegExp('\\b' + IDB + '\\b') },
  { label: '<' + TEXTAREA, re: new RegExp('<' + TEXTAREA + '\\b') },
  { label: '<' + SELECT, re: new RegExp('<' + SELECT + '\\b') },
  // A JSX attribute: whitespace, the name, `=` with no space, then a value. `const style = {}` does not match.
  { label: STYLE + '=', re: new RegExp('\\s' + STYLE + '=\\s*[{"\']') },
];

// A tag runs from its opening `<` to the first `>` that is not part of an arrow `=>`.
const TAG_BODY = '(?:=>|[^>])*>';
const INPUT_TAG = new RegExp('<' + INPUT + '\\b' + TAG_BODY, 'g');
const CHECKBOX_TYPE = /\btype\s*=\s*(?:"checkbox"|'checkbox'|\{\s*['"]checkbox['"]\s*\})/;
// `<a` followed by whitespace or `>`, so `<abbr`, `<article`, `<aside` and `<Link` do not match.
const ANCHOR_TAG = new RegExp('<a(?=[\\s>])' + TAG_BODY, 'g');
const TARGET_BLANK = /\btarget\s*=\s*(?:"_blank"|'_blank'|\{\s*['"]_blank['"]\s*\})/;
const REL_SAFE = /\brel\s*=\s*(?:"noopener noreferrer"|'noopener noreferrer'|\{\s*['"]noopener noreferrer['"]\s*\})/;
// href="…", href='…', href={'…'}, href={"…"}, href={`…`} or href={NAME}.
const HREF = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`|([A-Za-z_$][\w$]*))\s*\})/;

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

/** Returns the string value of `const name = '…'` (or `"…"`) in `source`, or `undefined`. */
function constValue(source: string, name: string): string | undefined {
  const escaped = name.replace(/\$/g, '\\$');
  const m = new RegExp('\\bconst\\s+' + escaped + '\\s*(?::\\s*string\\s*)?=\\s*(?:\'([^\']*)\'|"([^"]*)")').exec(
    source,
  );
  if (m === null) return undefined;
  return m[1] ?? m[2];
}

/** Returns the anchor's href value: a string literal, or a same-file string constant it names. */
function hrefValue(source: string, tag: string): string | undefined {
  const m = HREF.exec(tag);
  if (m === null) return undefined;
  const literal = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5];
  if (literal !== undefined) return literal;
  const name = m[6];
  return name === undefined ? undefined : constValue(source, name);
}

/** Returns `line label` for every finding in `source`. */
function scan(source: string): string[] {
  const hits: string[] = [];
  source.split('\n').forEach((line, i) => {
    for (const { label, re } of FORBIDDEN) {
      if (re.test(line)) hits.push(`${i + 1} ${label}`);
    }
  });
  for (const m of source.matchAll(INPUT_TAG)) {
    if (!CHECKBOX_TYPE.test(m[0])) hits.push(`${lineOf(source, m.index)} <${INPUT} without type checkbox`);
  }
  for (const m of source.matchAll(ANCHOR_TAG)) {
    const line = lineOf(source, m.index);
    const href = hrefValue(source, m[0]);
    if (href === undefined || !href.startsWith(HTTPS)) hits.push(`${line} <a without an ${HTTPS} href`);
    if (!TARGET_BLANK.test(m[0])) hits.push(`${line} <a without target _blank`);
    if (!REL_SAFE.test(m[0])) hits.push(`${line} <a without rel noopener noreferrer`);
  }
  return hits;
}

describe('app privacy scan (Req 14.1, 14.2, 14.4, 14.5, 14.8)', () => {
  it('the patterns match sample code and leave safe code alone', () => {
    const goodRel = ' target="_blank" rel="noopener noreferrer"';
    const samples = [
      FETCH + '("' + HTTPS + 'example.com")',
      'new ' + XHR + '()',
      'navigator.' + BEACON + '(u, d)',
      'new ' + SOCKET + '(u)',
      'window.' + LOCAL + '.setItem(k, v)',
      SESSION + '.getItem(k)',
      'window.' + IDB + '.open("db")',
      '<' + INPUT + ' name="n" />',
      '<' + INPUT + ' type="text" />',
      '<' + INPUT + '\n  onChange={() => go()}\n  type="email"\n/>',
      '<' + TEXTAREA + ' rows={3} />',
      '<' + SELECT + ' value={v}>',
      '<div ' + STYLE + '={{ color: "red" }} />',
      '<p ' + STYLE + '="color: red">',
      '<a>x</a>',
      '<a href="http://example.com"' + goodRel + '>x</a>',
      '<a href="javascript:alert(1)"' + goodRel + '>x</a>',
      '<a href="' + HTTPS + 'example.com" rel="noopener noreferrer">x</a>',
      '<a href="' + HTTPS + 'example.com" target="_blank">x</a>',
      '<a href="' + HTTPS + 'example.com" target="_blank" rel="noopener">x</a>',
      "const U = 'http://example.com';\n<a href={U}" + goodRel + '>x</a>',
      '<a href={unknownUrl}' + goodRel + '>x</a>',
      '<a\n  onClick={() => go()}\n  href="/local"\n' + goodRel + '\n>x</a>',
    ];
    for (const sample of samples) expect(scan(sample), sample).not.toEqual([]);
    const safe = [
      'const prefetched = 1; el.textContent = s; const style = { a: 1 };',
      '<' + INPUT + ' type="checkbox" value={id} />',
      '<' + INPUT + '\n  onChange={() => go()}\n  type="checkbox"\n/>',
      '<abbr title="t">x</abbr><article><aside>y</aside></article>',
      '<Link to="/">Home</Link>',
      '<div className="' + SELECT + 'ed">',
      '<a href="' + HTTPS + 'example.com"' + goodRel + '>x</a>',
      "const SITE_URL = '" + HTTPS + "example.com';\n<a href={SITE_URL}" + goodRel + '>x</a>',
      '<a\n  onClick={() => go()}\n  href={"' + HTTPS + 'example.com"}\n' + goodRel + '\n>x</a>',
    ];
    for (const sample of safe) expect(scan(sample), sample).toEqual([]);
  });

  it('no file under apps/shop-challenge/src breaks the privacy or safe-rendering rules', () => {
    const files = listFiles(APP_SRC);
    expect(files.length).toBeGreaterThan(0);
    expect(files.map(rel).some((f) => f.endsWith('.tsx'))).toBe(true);
    // The tag patterns must find the checkbox inputs and the footer anchors, or those checks would pass vacuously.
    const collectionView = readFileSync(join(APP_SRC, 'views', 'CollectionSelectNodeView.tsx'), 'utf8');
    expect([...collectionView.matchAll(INPUT_TAG)].length).toBeGreaterThan(0);
    const footer = readFileSync(join(APP_SRC, 'app', 'Footer.tsx'), 'utf8');
    expect([...footer.matchAll(ANCHOR_TAG)].length).toBe(2);
    const hits = files.flatMap((file) => scan(readFileSync(file, 'utf8')).map((hit) => `${rel(file)}:${hit}`));
    expect(hits).toEqual([]);
  });
});
