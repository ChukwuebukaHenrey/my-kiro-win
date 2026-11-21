/**
 * Hook file test of the ui-renderer design C13 (Requirements 15.12, 17.1, 17.12).
 *
 * Reads every file in `.kiro/hooks/` and checks it against the hook file model and the
 * H1-H4 JSON of design C13. Matchers are built as `RegExp`s from the parsed JSON strings.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const HOOKS_DIR = join(ROOT, '.kiro', 'hooks');

const HOOK_FILES = [
  'node-type-wiring.json',
  'post-task-check.json',
  'runtime-regression.json',
  'validate-activities.json',
] as const;
type HookFileName = (typeof HOOK_FILES)[number];

/** Trigger names of the hook file model (design "Hook file model"). */
const TRIGGERS = [
  'PostFileCreate',
  'PostFileSave',
  'PostFileDelete',
  'PreToolUse',
  'PostToolUse',
  'SessionStart',
  'Stop',
  'UserPromptSubmit',
  'PreTaskExec',
  'PostTaskExec',
  'PreCompact',
  'PostCompact',
  'PermissionRequest',
];

/** Matchers of design C13, unescaped (one backslash per regex backslash). */
const ACTIVITY_MATCHER = String.raw`^(?:[A-Za-z]:)?[\\/]?(?:[A-Za-z0-9._ -]+[\\/])*activities[\\/](?:[A-Za-z0-9._-]+[\\/])*[A-Za-z0-9._-]+\.json$`;
const REGRESSION_MATCHER = String.raw`packages[\\/](runtime|schema|node-types)[\\/].*\.ts$`;
const WIRING_MATCHER = [
  String.raw`(^|[\\/])packages[\\/]node-types[\\/]src[\\/][a-z][A-Za-z0-9]{0,31}\.ts$`,
  String.raw`(^|[\\/])packages[\\/]ui[\\/]src[\\/]views[\\/][A-Z][A-Za-z0-9]{0,31}NodeView\.tsx$`,
  String.raw`(^|[\\/])apps[\\/][a-z0-9-]+[\\/]src[\\/]node-types[\\/][a-z][A-Za-z0-9]{0,31}\.ts$`,
  String.raw`(^|[\\/])apps[\\/][a-z0-9-]+[\\/]src[\\/]views[\\/][A-Z][A-Za-z0-9]{0,31}NodeView\.tsx$`,
].join('|');

interface ExpectedHook {
  readonly name: string;
  readonly trigger: string;
  readonly matcher: string | undefined;
  readonly type: 'command' | 'agent';
  readonly command: string | undefined;
  readonly timeout: number | undefined;
}

const VALIDATE_COMMAND = 'pnpm -s validate:hook "{{filePath}}"';

/** The table at the start of C13 and the JSON in H1-H4, in file order. */
const EXPECTED: Readonly<Record<HookFileName, readonly ExpectedHook[]>> = {
  'validate-activities.json': [
    { name: 'validate-activities', trigger: 'PostFileSave', matcher: ACTIVITY_MATCHER, type: 'command', command: VALIDATE_COMMAND, timeout: 30 },
    { name: 'validate-activities-on-create', trigger: 'PostFileCreate', matcher: ACTIVITY_MATCHER, type: 'command', command: VALIDATE_COMMAND, timeout: 30 },
  ],
  'runtime-regression.json': [
    { name: 'runtime-regression', trigger: 'PostFileSave', matcher: REGRESSION_MATCHER, type: 'command', command: 'pnpm -s test:shared', timeout: 180 },
  ],
  'node-type-wiring.json': [
    { name: 'node-type-wiring', trigger: 'PostFileSave', matcher: WIRING_MATCHER, type: 'agent', command: undefined, timeout: undefined },
    { name: 'node-type-wiring-on-create', trigger: 'PostFileCreate', matcher: WIRING_MATCHER, type: 'agent', command: undefined, timeout: undefined },
  ],
  'post-task-check.json': [
    { name: 'post-task-check', trigger: 'PostTaskExec', matcher: undefined, type: 'command', command: 'pnpm -s check', timeout: 300 },
  ],
};

/** Text that must not appear in any Hook_File (Requirement 15.12). */
const FORBIDDEN_TEXT = ['Remove-Item', 'rm -', 'rmdir', 'del ', '.kiro/settings', '.kiro\\settings', '--no-verify'];

/** A key that names a secret, assigned a value of at least 8 characters, or a known token prefix. */
const SECRET_ASSIGNMENT =
  /(api[_-]?key|secret|token|passw(or)?d|pwd|private[_-]?key|access[_-]?key|auth)["']?\s*[:=]\s*["']?[A-Za-z0-9_\-+/=.]{8,}/i;
const TOKEN_PREFIX = /\b(sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|xox[abp]-[A-Za-z0-9-]{10,})/;

/** The seven phrases the prompt of both H3 hooks contains. */
const WIRING_PROMPT_PHRASES = [
  '#new-node-type',
  'exactly once',
  'additionalProperties: false',
  'reduce',
  'fast-check',
  'EXTENDING.md',
  'pnpm -s test:shared',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readText(file: string): string {
  return readFileSync(join(HOOKS_DIR, file), 'utf8');
}

/** The `hooks` array of `file`; throws when the file lacks one. */
function readHooks(file: string): Record<string, unknown>[] {
  const parsed: unknown = JSON.parse(readText(file));
  if (!isRecord(parsed) || !Array.isArray(parsed.hooks)) throw new Error(`${file} has no "hooks" array`);
  return parsed.hooks.map((hook: unknown, i: number) => {
    if (!isRecord(hook)) throw new Error(`hook ${i} in ${file} is not an object`);
    return hook;
  });
}

function action(hook: Record<string, unknown>): Record<string, unknown> {
  return isRecord(hook.action) ? hook.action : {};
}

/** The matcher of the first hook in `file`, built as a `RegExp` from the parsed JSON string. */
function matcherOf(file: HookFileName): RegExp {
  const matcher = readHooks(file)[0]?.matcher;
  if (typeof matcher !== 'string') throw new Error(`${file} has no string matcher`);
  return new RegExp(matcher);
}

const jsonFiles = readdirSync(HOOKS_DIR).filter((name) => name.endsWith('.json'));
const allHooks = (): { file: string; hook: Record<string, unknown> }[] =>
  jsonFiles.flatMap((file) => readHooks(file).map((hook) => ({ file, hook })));

describe('Hook_Files in .kiro/hooks (Requirement 17.1)', () => {
  it('holds exactly the four Hook_Files and no other file', () => {
    expect(readdirSync(HOOKS_DIR).sort()).toEqual([...HOOK_FILES]);
  });

  it.each(jsonFiles)('%s is valid JSON with version "v1" and a non-empty hooks array', (file) => {
    const parsed: unknown = JSON.parse(readText(file));
    expect(isRecord(parsed)).toBe(true);
    if (!isRecord(parsed)) return;
    expect(parsed.version).toBe('v1');
    expect(Array.isArray(parsed.hooks)).toBe(true);
    expect((parsed.hooks as unknown[]).length).toBeGreaterThan(0);
  });
});

describe('hook fields (hook file model)', () => {
  it('every hook has a name, a documented trigger and a command or agent action', () => {
    for (const { file, hook } of allHooks()) {
      const where = `${file} ${String(hook.name)}`;
      expect(typeof hook.name === 'string' && hook.name.length > 0, where).toBe(true);
      expect(TRIGGERS, where).toContain(hook.trigger);
      const act = action(hook);
      const ok =
        (act.type === 'command' && typeof act.command === 'string') ||
        (act.type === 'agent' && typeof act.prompt === 'string');
      expect(ok, where).toBe(true);
    }
  });

  it('hook names are unique across the files and every hook sets enabled: true', () => {
    const hooks = allHooks();
    const names = hooks.map(({ hook }) => hook.name);
    expect(new Set(names).size).toBe(names.length);
    for (const { file, hook } of hooks) expect(hook.enabled, `${file} ${String(hook.name)}`).toBe(true);
  });

  it('every matcher compiles as a RegExp and has no lookahead or lookbehind', () => {
    for (const { file, hook } of allHooks()) {
      if (hook.matcher === undefined) continue;
      const where = `${file} ${String(hook.name)}`;
      expect(typeof hook.matcher, where).toBe('string');
      const matcher = String(hook.matcher);
      expect(() => new RegExp(matcher), where).not.toThrow();
      for (const token of ['(?=', '(?!', '(?<=', '(?<!']) expect(matcher, where).not.toContain(token);
    }
  });

  it('every command hook has an integer timeout from 1 to 300', () => {
    for (const { file, hook } of allHooks()) {
      if (action(hook).type !== 'command') continue;
      const where = `${file} ${String(hook.name)}`;
      expect(Number.isInteger(hook.timeout), where).toBe(true);
      expect(hook.timeout as number, where).toBeGreaterThanOrEqual(1);
      expect(hook.timeout as number, where).toBeLessThanOrEqual(300);
    }
  });
});

describe('Hook_Files match design C13 H1-H4 (Requirement 17.12)', () => {
  it.each(HOOK_FILES)('%s has the name, trigger, matcher, action type, command and timeout of C13', (file) => {
    const actual = readHooks(file).map((hook) => ({
      name: hook.name,
      trigger: hook.trigger,
      matcher: hook.matcher,
      type: action(hook).type,
      command: action(hook).command,
      timeout: hook.timeout,
    }));
    expect(actual).toEqual(EXPECTED[file]);
  });
});

describe('forbidden text (Requirement 15.12)', () => {
  it('detects a secret-like assignment and a token prefix', () => {
    expect(SECRET_ASSIGNMENT.test('"apiKey": "abcd1234efgh"')).toBe(true);
    expect(SECRET_ASSIGNMENT.test('PASSWORD=hunter2hunter2')).toBe(true);
    expect(TOKEN_PREFIX.test('ghp_abcdefghijklmnopqrstuvwxyz')).toBe(true);
    expect(SECRET_ASSIGNMENT.test('"timeout": 300')).toBe(false);
  });

  it.each(jsonFiles)('%s has no delete command, settings path, --no-verify or secret', (file) => {
    const text = readText(file);
    const lower = text.toLowerCase();
    for (const token of FORBIDDEN_TEXT) expect(lower, `${file}: ${token}`).not.toContain(token.toLowerCase());
    expect(SECRET_ASSIGNMENT.test(text), `${file}: secret-like assignment`).toBe(false);
    expect(TOKEN_PREFIX.test(text), `${file}: token`).toBe(false);
  });
});

describe('matcher examples (design C13 "Hook file test")', () => {
  it('H1 matches activity JSON paths and rejects other paths', () => {
    const h1 = matcherOf('validate-activities.json');
    expect(h1.test('activities/new.json')).toBe(true);
    expect(h1.test('C:\\Users\\ADMIN\\my-kiro-win\\activities\\fixtures\\broken-dangling-edge.json')).toBe(true);
    expect(h1.test('packages/ui/src/x.json')).toBe(false);
    expect(h1.test('activities/a$(b).json')).toBe(false);
    expect(h1.test('activities/x.txt')).toBe(false);
  });

  it('H2 matches .ts files of runtime, schema and node-types and rejects ui', () => {
    const h2 = matcherOf('runtime-regression.json');
    expect(h2.test('packages/runtime/src/reducer.ts')).toBe(true);
    expect(h2.test('packages\\schema\\test\\graph.test.ts')).toBe(true);
    expect(h2.test('packages/node-types/src/choice.ts')).toBe(true);
    expect(h2.test('packages/ui/src/index.ts')).toBe(false);
  });

  it('H3 matches node type and view files and rejects core-types.ts', () => {
    const h3 = matcherOf('node-type-wiring.json');
    expect(h3.test('packages/node-types/src/quiz.ts')).toBe(true);
    expect(h3.test('packages\\ui\\src\\views\\QuizNodeView.tsx')).toBe(true);
    expect(h3.test('apps/shop-challenge/src/node-types/collectionSelect.ts')).toBe(true);
    expect(h3.test('packages/node-types/src/core-types.ts')).toBe(false);
  });

  it('H4 has no matcher', () => {
    for (const hook of readHooks('post-task-check.json')) expect('matcher' in hook).toBe(false);
  });
});

describe('Wiring_Hook prompt (Requirement 15)', () => {
  it('the prompt of both H3 hooks contains the seven required phrases', () => {
    const hooks = readHooks('node-type-wiring.json');
    expect(hooks).toHaveLength(2);
    for (const hook of hooks) {
      const prompt = action(hook).prompt;
      expect(typeof prompt).toBe('string');
      for (const phrase of WIRING_PROMPT_PHRASES) expect(String(prompt), phrase).toContain(phrase);
    }
  });
});
