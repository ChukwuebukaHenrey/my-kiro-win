// Built-output checks for the Shop_App (Requirement 14.6, design C13, D44). Runs at the end of the
// app `build` script under `node --experimental-strip-types`. Paths resolve from this file, so the
// script works from the repo root and from the app folder. Imports only `node:*` modules.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

/** App JavaScript budget: 150 KB gzip (Architecture Spec section A7, D44). */
const JS_GZIP_LIMIT = 153_600;

const indexPath = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const assetsDir = fileURLToPath(new URL('../dist/assets/', import.meta.url));

/** Returns one message per inline script, inline style element or style attribute in `html`. */
function findInlineCode(html: string): string[] {
  const problems: string[] = [];
  for (const match of html.matchAll(/<script\b[^>]*>/gi)) {
    if (!/\ssrc\s*=/i.test(match[0])) problems.push(`inline script: ${match[0]}`);
  }
  for (const match of html.matchAll(/<style\b[^>]*>/gi)) {
    problems.push(`inline style element: ${match[0]}`);
  }
  for (const match of html.matchAll(/<[^>]*\sstyle\s*=[^>]*>/gi)) {
    problems.push(`style attribute: ${match[0]}`);
  }
  return problems;
}

function main(): number {
  if (!existsSync(indexPath)) {
    console.error(`check-dist: missing dist/index.html (${indexPath}); run the app build first`);
    return 1;
  }
  if (!existsSync(assetsDir)) {
    console.error(`check-dist: missing dist/assets (${assetsDir}); run the app build first`);
    return 1;
  }

  let failed = false;

  const problems = findInlineCode(readFileSync(indexPath, 'utf8'));
  if (problems.length === 0) {
    console.log('check-dist: dist/index.html has no inline script, no style element and no style attribute');
  } else {
    failed = true;
    console.error(`check-dist: dist/index.html has ${problems.length} inline code problem(s):`);
    for (const problem of problems) console.error(`  ${problem}`);
  }

  const jsFiles = readdirSync(assetsDir)
    .filter((name) => name.endsWith('.js'))
    .sort();
  let gzipTotal = 0;
  for (const name of jsFiles) {
    gzipTotal += gzipSync(readFileSync(join(assetsDir, name))).length;
  }
  const budget = `${gzipTotal} gzip bytes in ${jsFiles.length} file(s) of dist/assets/*.js (limit ${JS_GZIP_LIMIT})`;
  if (gzipTotal <= JS_GZIP_LIMIT) {
    console.log(`check-dist: JS budget ok, ${budget}`);
  } else {
    failed = true;
    console.error(`check-dist: JS budget exceeded, ${budget}`);
  }

  return failed ? 1 : 0;
}

process.exitCode = main();
