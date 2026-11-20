/**
 * Output formatting for the validate CLI (Requirement 17.7).
 *
 * Diagnostic messages, paths and file names can carry manifest or file-system text, so
 * every printed line goes through `escapeControl`. It replaces each C0 control
 * (U+0000–U+001F, including CR, LF and the ESC that starts ANSI sequences), DEL and the
 * C1 controls (U+007F–U+009F), the line and paragraph separators (U+2028, U+2029) and the
 * bidirectional embedding, override and isolate characters (U+202A–U+202E, U+2066–U+2069)
 * with a visible `\uXXXX` escape. A manifest therefore cannot start a new output line,
 * recolour the terminal or reorder the visible text to forge a `PASS` line.
 */

import type { Diagnostic } from '@dreame/schema';

const UNSAFE_CHARS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g;

/** Replaces control, line-separator and bidi-control characters with `\uXXXX`. */
export function escapeControl(text: string): string {
  return text.replace(UNSAFE_CHARS, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

/** `  <severity> <stage>/<code> at <path>: <message>`, as one line with no control characters. */
export function formatDiagnostic(d: Diagnostic): string {
  return escapeControl(`  ${d.severity} ${d.stage}/${d.code} at ${d.path}: ${d.message}`);
}
