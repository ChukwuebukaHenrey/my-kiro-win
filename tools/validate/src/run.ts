/**
 * Validate CLI core (Requirements 5.5, 5.6, 17.4–17.12, design Component 4).
 *
 * `run` touches no `process` and no `node:fs`: all IO goes through `CliIo`, so tests can
 * pass an in-memory implementation and `src/cli.ts` wires the real one.
 */

import {
  HARD_LIMITS,
  MAX_MANIFEST_JSON_BYTES,
  parseManifestText,
  severityOf,
  validateManifest,
  type Diagnostic,
  type DiagnosticCode,
  type ProfileDescriptor,
} from '@dreame/schema';
import { coreProfile } from '@dreame/node-types';
import { expandArgs } from './expand.ts';
import { escapeControl, formatDiagnostic } from './format.ts';

export interface CliIo {
  /** Raw file bytes; `null` if the file is missing or unreadable. */
  readFile(path: string): Uint8Array | null;
  /** Names of the regular files in `dir`; `null` if the directory is missing. */
  listFiles(dir: string): string[] | null;
  out(line: string): void;
  err(line: string): void;
}

export const PROFILES: Readonly<Record<string, ProfileDescriptor>> = Object.freeze({ core: coreProfile });

const USAGE = 'usage: pnpm validate <file-or-pattern>...  (wildcards * and ? are allowed in the last path segment only)';

/** Longest manifest `profile` value quoted in an `unknown-profile` message. */
const MAX_QUOTED_PROFILE = 64;

function parseDiag(code: DiagnosticCode, path: string, message: string): Diagnostic {
  return { severity: severityOf(code), stage: 'parse', code, path, message };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Byte cap → strict UTF-8 decode → parse → profile lookup → `validateManifest`. */
function checkBytes(bytes: Uint8Array): { ok: boolean; diagnostics: Diagnostic[] } {
  if (bytes.length > MAX_MANIFEST_JSON_BYTES) {
    return {
      ok: false,
      diagnostics: [
        parseDiag('too-large', '', `file is ${bytes.length} bytes; the limit is ${MAX_MANIFEST_JSON_BYTES} bytes`),
      ],
    };
  }

  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, diagnostics: [parseDiag('invalid-utf8', '', 'file is not valid UTF-8')] };
  }

  const parsed = parseManifestText(text);
  if (!parsed.ok) return { ok: false, diagnostics: parsed.diagnostics };

  const known = Object.keys(PROFILES).join(', ');
  const value = parsed.value;
  const profileId = isRecord(value) ? value['profile'] : undefined;
  if (typeof profileId !== 'string' || !Object.hasOwn(PROFILES, profileId)) {
    const message =
      typeof profileId === 'string'
        ? `profile ${JSON.stringify(profileId.slice(0, MAX_QUOTED_PROFILE))}${profileId.length > MAX_QUOTED_PROFILE ? ' (truncated)' : ''} is not one of: ${known}`
        : `profile is missing or not a string; expected one of: ${known}`;
    return { ok: false, diagnostics: [parseDiag('unknown-profile', isRecord(value) ? '/profile' : '', message)] };
  }

  const result = validateManifest(value, PROFILES[profileId] as ProfileDescriptor);
  return { ok: result.ok, diagnostics: result.diagnostics };
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  try {
    return String(e);
  } catch {
    return 'unknown error';
  }
}

/** Checks one file and prints its result. Returns `true` if it passed. */
function checkFile(file: string, io: CliIo): boolean {
  const name = escapeControl(file);
  try {
    const bytes = io.readFile(file);
    if (bytes === null) {
      io.out(`FAIL ${name}: file is missing or unreadable`);
      return false;
    }
    const { ok, diagnostics } = checkBytes(bytes);
    if (ok) {
      io.out(`PASS ${name}`);
      for (const d of diagnostics) io.out(formatDiagnostic(d));
      return true;
    }
    io.out(`FAIL ${name}`);
    for (const d of diagnostics.slice(0, HARD_LIMITS.maxDiagnostics)) io.out(formatDiagnostic(d));
    return false;
  } catch (e) {
    // Message only, no stack trace (Requirement 17.9).
    io.out(`FAIL ${name}: internal error: ${escapeControl(errorMessage(e))}`);
    return false;
  }
}

/** Exit codes: 0 all passed, 1 at least one failed, 2 usage error. */
export function run(argv: readonly string[], io: CliIo): 0 | 1 | 2 {
  if (argv.length === 0) {
    io.err(USAGE);
    return 2;
  }
  const { files, errors } = expandArgs(argv, io);
  if (errors.length > 0) {
    for (const e of errors) io.err(`error: ${escapeControl(e)}`);
    io.err(USAGE);
    return 2;
  }
  let failed = false;
  for (const file of files) {
    if (!checkFile(file, io)) failed = true;
  }
  return failed ? 1 : 0;
}
