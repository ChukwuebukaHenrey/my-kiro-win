/**
 * Wildcard expansion for the validate CLI (Requirements 17.1, 17.2, 17.3, 17.12).
 *
 * `cmd.exe` passes `activities/*.json` unexpanded while `sh` expands it, so the CLI
 * expands patterns itself. Only `*` and `?` in the last path segment are supported.
 *
 * Path form: `\` and `/` are both treated as separators, and every output path
 * (expanded or passed through) uses `/`. Node's `fs` accepts `/` on Windows, and one
 * form lets an already-expanded list and the pattern de-duplicate to the same result.
 */

export interface DirReader {
  /** Names (not paths) of the regular files in `dir`, excluding directories; `null` if the directory is missing. */
  listFiles(dir: string): string[] | null;
}

export type ExpandResult = { files: string[]; errors: string[] };

function hasWildcard(s: string): boolean {
  return s.includes('*') || s.includes('?');
}

/** Code-unit order, independent of locale. */
function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Matches `name` against `pattern`, where `*` matches any run of characters
 * (including none) and `?` matches exactly one character. Every other character is
 * literal. Works on code points, with no RegExp built from user input.
 */
export function matchSegment(pattern: string, name: string): boolean {
  const p = Array.from(pattern);
  const n = Array.from(name);
  let pi = 0;
  let ni = 0;
  let starPi = -1;
  let starNi = 0;
  while (ni < n.length) {
    if (pi < p.length && (p[pi] === '?' || (p[pi] !== '*' && p[pi] === n[ni]))) {
      pi++;
      ni++;
    } else if (pi < p.length && p[pi] === '*') {
      starPi = pi;
      starNi = ni;
      pi++;
    } else if (starPi !== -1) {
      pi = starPi + 1;
      starNi++;
      ni = starNi;
    } else {
      return false;
    }
  }
  while (pi < p.length && p[pi] === '*') pi++;
  return pi === p.length;
}

/** Directory to list for a prefix such as `activities/`, `./`, `/` or `C:/`. */
function listDirFor(prefix: string): string {
  if (prefix === '') return '.';
  const trimmed = prefix.slice(0, -1);
  if (trimmed === '' || trimmed.endsWith(':')) return prefix;
  return trimmed;
}

export function expandArgs(args: readonly string[], fs: DirReader): ExpandResult {
  const found = new Set<string>();
  const errors: string[] = [];

  for (const arg of args) {
    const path = arg.split('\\').join('/');
    if (!hasWildcard(path)) {
      // Plain path: passed through without an existence check (Requirement 17.2).
      found.add(path);
      continue;
    }
    if (path.includes('**')) {
      errors.push(`unsupported pattern "${arg}": "**" is not supported`);
      continue;
    }
    const cut = path.lastIndexOf('/');
    const prefix = path.slice(0, cut + 1);
    const segment = path.slice(cut + 1);
    if (hasWildcard(prefix)) {
      errors.push(`unsupported pattern "${arg}": wildcards are allowed in the last path segment only`);
      continue;
    }
    const names = fs.listFiles(listDirFor(prefix)) ?? [];
    let matched = 0;
    for (const name of names) {
      // Like sh, a leading "." in a file name must be matched literally.
      if (name.startsWith('.') && !segment.startsWith('.')) continue;
      if (matchSegment(segment, name)) {
        found.add(prefix + name);
        matched++;
      }
    }
    if (matched === 0) errors.push(`no files match "${arg}"`);
  }

  return { files: [...found].sort(compareCodeUnits), errors };
}
