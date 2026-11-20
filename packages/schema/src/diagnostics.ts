import type { NodeId } from './contracts.ts';

export type Stage = 'parse' | 'schema' | 'caps' | 'ids' | 'refs' | 'dag' | 'terminal' | 'conditions';
export type Severity = 'error' | 'warning';
export type DiagnosticCode =
  | 'too-large' | 'invalid-utf8' | 'invalid-json' | 'unknown-profile'
  | 'schema' | 'unknown-node-type' | 'profile-mismatch'
  | 'node-cap' | 'transition-cap'
  | 'duplicate-node-id' | 'duplicate-var-id' | 'duplicate-option-id'
  | 'dangling-ref' | 'undeclared-var' | 'requires-missing' | 'requires-version' | 'requires-unknown' | 'requires-unused'
  | 'cycle'
  | 'dead-end' | 'terminal-has-edges' | 'last-edge-conditional' | 'fallback-not-terminal'
  | 'no-terminal-reachable' | 'unreachable-node' | 'limit-below-longest-path'
  | 'cond-too-deep' | 'type-mismatch' | 'ref-not-answerable' | 'answer-not-upstream'
  | 'var-decl-invalid' | 'effect-invalid' | 'invalid-date' | 'unsafe-url' | 'blank-text';

export interface Diagnostic {
  readonly severity: Severity;
  readonly stage: Stage;
  readonly code: DiagnosticCode;
  /** JSON Pointer into the manifest (`""` is the root). */
  readonly path: string;
  /** Plain language, no stack trace. */
  readonly message: string;
  readonly nodeId?: NodeId;
}

/** Stage order of Brief §3, with `parse` first. */
const STAGE_RANK: Readonly<Record<Stage, number>> = {
  parse: 0, schema: 1, caps: 2, ids: 3, refs: 4, dag: 5, terminal: 6, conditions: 7,
};

/** `requires-unused` is the only warning-level code (Req 7.10). */
export function severityOf(code: DiagnosticCode): Severity {
  return code === 'requires-unused' ? 'warning' : 'error';
}

/** Code-unit string comparison, independent of locale. */
function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareDiagnostics(a: Diagnostic, b: Diagnostic): number {
  return (
    STAGE_RANK[a.stage] - STAGE_RANK[b.stage] ||
    compareStrings(a.path, b.path) ||
    compareStrings(a.code, b.code) ||
    compareStrings(a.message, b.message) ||
    compareStrings(a.severity, b.severity) ||
    compareStrings(a.nodeId ?? '', b.nodeId ?? '') ||
    // An absent nodeId sorts before a present one, so `undefined` and `''` stay distinct.
    Number(a.nodeId !== undefined) - Number(b.nodeId !== undefined)
  );
}

/**
 * Returns a sorted copy: stage order, then `path`, then `code`, with tie-breaks on
 * `message`, `severity` and `nodeId`, so every permutation of the input gives the same output.
 */
export function sortDiagnostics(d: readonly Diagnostic[]): Diagnostic[] {
  return [...d].sort(compareDiagnostics);
}
