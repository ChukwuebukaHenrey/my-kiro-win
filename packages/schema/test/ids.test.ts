import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_ID_PATTERN,
  DATE_PATTERN,
  HARD_LIMITS,
  HTTPS_PREFIX_PATTERN,
  MAX_MANIFEST_JSON_BYTES,
  NODE_ID_PATTERN,
  THEME_PATTERN,
  TYPE_NAME_PATTERN,
  VAR_ID_PATTERN,
} from '../src/ids.ts';
import { severityOf, sortDiagnostics } from '../src/diagnostics.ts';
import type { Diagnostic, DiagnosticCode, Stage } from '../src/diagnostics.ts';

interface PatternCase {
  readonly name: string;
  readonly pattern: string;
  readonly expected: string;
  readonly accept: readonly string[];
  readonly reject: readonly string[];
}

const PATTERN_CASES: readonly PatternCase[] = [
  {
    name: 'NODE_ID_PATTERN',
    pattern: NODE_ID_PATTERN,
    expected: '^[A-Za-z][A-Za-z0-9_-]{0,63}$',
    accept: ['a', 'Start', 'q1', 'node_2-b', 'A'.repeat(64)],
    reject: ['', '__proto__', '_a', '1a', '-a', 'a b', 'a.b', 'é', 'A'.repeat(65), 'a\n'],
  },
  {
    name: 'VAR_ID_PATTERN',
    pattern: VAR_ID_PATTERN,
    expected: '^[A-Za-z][A-Za-z0-9_]{0,31}$',
    accept: ['score', 'S', 'total_2', 'a'.repeat(32)],
    reject: ['', '_x', '__proto__', '2x', 'a-b', 'a'.repeat(33)],
  },
  {
    name: 'TYPE_NAME_PATTERN',
    pattern: TYPE_NAME_PATTERN,
    expected: '^[a-z][A-Za-z0-9]{0,31}$',
    accept: ['content', 'collectionSelect', 'recall2', 'a'.repeat(32)],
    reject: ['', 'Content', '_x', 'review-queue', 'review_queue', '1a', 'a'.repeat(33)],
  },
  {
    name: 'ACTIVITY_ID_PATTERN',
    pattern: ACTIVITY_ID_PATTERN,
    expected: '^[a-z0-9][a-z0-9-]{0,63}$',
    accept: ['demo', '2026-promo', 'gift-bundle-1', 'a'.repeat(64)],
    reject: ['', '-demo', 'Demo', 'demo_1', 'demo.1', 'a'.repeat(65)],
  },
  {
    name: 'THEME_PATTERN',
    pattern: THEME_PATTERN,
    expected: '^[a-z0-9-]{1,32}$',
    accept: ['default', '-', 'dark-2', 'a'.repeat(32)],
    reject: ['', 'Dark', 'dark_mode', 'a'.repeat(33)],
  },
  {
    name: 'DATE_PATTERN',
    pattern: DATE_PATTERN,
    expected: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',
    accept: ['2026-11-19', '0000-00-00'],
    reject: ['', '2026-1-19', '26-11-19', '2026/11/19', '2026-11-19T00:00:00Z', ' 2026-11-19'],
  },
  {
    name: 'HTTPS_PREFIX_PATTERN',
    pattern: HTTPS_PREFIX_PATTERN,
    expected: '^https://',
    accept: ['https://wa.me/123', 'https://'],
    reject: ['', 'http://example.com', 'javascript:alert(1)', 'data:text/html,x', ' https://x', 'HTTPS://x'],
  },
];

describe('ID patterns (Req 2.3, 2.4)', () => {
  for (const c of PATTERN_CASES) {
    describe(c.name, () => {
      const re = new RegExp(c.pattern);

      it('has the Req 2.3 source', () => {
        expect(c.pattern).toBe(c.expected);
      });

      it.each(c.accept.map((s) => [s]))('accepts %j', (s) => {
        expect(re.test(s)).toBe(true);
      });

      it.each(c.reject.map((s) => [s]))('rejects %j', (s) => {
        expect(re.test(s)).toBe(false);
      });
    });
  }

  it('rejects every node ID that starts with "_", including __proto__ (Req 2.4)', () => {
    const re = new RegExp(NODE_ID_PATTERN);
    for (const id of ['__proto__', '_a', '_', '_constructor', '__defineGetter__']) {
      expect(re.test(id)).toBe(false);
    }
  });
});

describe('limits (Req 2.2)', () => {
  it('MAX_MANIFEST_JSON_BYTES is 65,536', () => {
    expect(MAX_MANIFEST_JSON_BYTES).toBe(65_536);
  });

  it('HARD_LIMITS has exactly the Req 2.2 values', () => {
    expect(HARD_LIMITS).toStrictEqual({
      maxNodes: 200,
      maxTransitions: 1_000,
      maxEdgesPerNode: 16,
      maxVariables: 32,
      maxCondDepth: 8,
      maxCondArgs: 8,
      maxOptions: 8,
      maxEffectsPerOption: 8,
      maxTextLength: 2_000,
      maxDiagnostics: 50,
    });
  });
});

const ALL_CODES: readonly DiagnosticCode[] = [
  'too-large', 'invalid-utf8', 'invalid-json', 'unknown-profile',
  'schema', 'unknown-node-type', 'profile-mismatch',
  'node-cap', 'transition-cap',
  'duplicate-node-id', 'duplicate-var-id', 'duplicate-option-id',
  'dangling-ref', 'undeclared-var', 'requires-missing', 'requires-version', 'requires-unknown', 'requires-unused',
  'cycle',
  'dead-end', 'terminal-has-edges', 'last-edge-conditional', 'fallback-not-terminal',
  'no-terminal-reachable', 'unreachable-node', 'limit-below-longest-path',
  'cond-too-deep', 'type-mismatch', 'ref-not-answerable', 'answer-not-upstream',
  'var-decl-invalid', 'effect-invalid', 'invalid-date', 'unsafe-url', 'blank-text',
  'duplicate-item-id', 'select-unsatisfiable',
];

describe('severityOf (Req 7.10)', () => {
  it('gives warning for requires-unused', () => {
    expect(severityOf('requires-unused')).toBe('warning');
  });

  it.each(ALL_CODES.filter((c) => c !== 'requires-unused').map((c) => [c]))('gives error for %s', (code) => {
    expect(severityOf(code)).toBe('error');
  });
});

function diag(stage: Stage, path: string, code: DiagnosticCode, message = 'm', nodeId?: string): Diagnostic {
  const base = { severity: severityOf(code), stage, code, path, message };
  return nodeId === undefined ? base : { ...base, nodeId };
}

describe('sortDiagnostics (Req 7.9)', () => {
  // Expected order: stage rank first, then path (code-unit order), then code.
  const expected: readonly Diagnostic[] = [
    diag('parse', '', 'too-large'),
    diag('schema', '', 'schema'),
    diag('schema', '/nodes/0', 'schema'),
    diag('caps', '', 'node-cap'),
    diag('ids', '/nodes/1/id', 'duplicate-node-id', 'm', 'b'),
    diag('refs', '/nodes/10/edges/0/to', 'dangling-ref'),
    diag('refs', '/nodes/2/edges/0/to', 'dangling-ref'),
    diag('refs', '/requires/choice', 'requires-unused'),
    diag('refs', '/requires/choice', 'requires-version'),
    diag('dag', '/nodes/3', 'cycle', 'm', 'c'),
    diag('terminal', '/nodes/4', 'dead-end'),
    diag('terminal', '/nodes/4', 'unreachable-node'),
    diag('conditions', '/nodes/0/edges/0/when', 'cond-too-deep'),
    diag('conditions', '/nodes/0/edges/0/when', 'type-mismatch'),
  ];

  const shuffled: readonly Diagnostic[] = [
    expected[13]!, expected[7]!, expected[0]!, expected[10]!, expected[5]!, expected[2]!, expected[12]!,
    expected[8]!, expected[3]!, expected[11]!, expected[1]!, expected[6]!, expected[9]!, expected[4]!,
  ];

  it('orders by stage, then path, then code', () => {
    expect(sortDiagnostics(shuffled)).toStrictEqual(expected);
  });

  it('gives the same output for the reversed and rotated input', () => {
    expect(sortDiagnostics([...expected].reverse())).toStrictEqual(expected);
    expect(sortDiagnostics([...shuffled.slice(5), ...shuffled.slice(0, 5)])).toStrictEqual(expected);
  });

  it('is idempotent and returns a new array without changing its input', () => {
    const input = Object.freeze([...shuffled]);
    const once = sortDiagnostics(input);
    expect(once).not.toBe(input);
    expect(input).toStrictEqual(shuffled);
    expect(sortDiagnostics(once)).toStrictEqual(once);
  });

  it('breaks full ties on message, severity and nodeId so permutations agree', () => {
    const a = diag('refs', '/x', 'dangling-ref', 'alpha');
    const b = diag('refs', '/x', 'dangling-ref', 'beta');
    const c = diag('refs', '/x', 'dangling-ref', 'beta', 'n1');
    expect(sortDiagnostics([c, b, a])).toStrictEqual([a, b, c]);
    expect(sortDiagnostics([b, a, c])).toStrictEqual([a, b, c]);
  });
});
