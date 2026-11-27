import { describe, expect, it } from 'vitest';
import { RESERVED_NAMES, derive, isValidName } from '../src/name.ts';

describe('isValidName', () => {
  it('accepts names that match the rule', () => {
    for (const name of ['ab', 'quiz-sprint', 'a1', 'app2-x9', 'a-b-c']) {
      expect(isValidName(name), name).toBe(true);
    }
  });

  it('rejects bad patterns', () => {
    for (const name of [
      '',
      '1app',
      '-app',
      'app-',
      'a--b',
      'Quiz',
      'quiz_sprint',
      'quiz sprint',
      'quiz.sprint',
      '../x',
      'a/b',
      'ü-app',
    ]) {
      expect(isValidName(name), name).toBe(false);
    }
  });

  it('enforces length 2..31', () => {
    expect(isValidName('a')).toBe(false);
    expect(isValidName('ab')).toBe(true);
    expect(isValidName('a'.repeat(31))).toBe(true);
    expect(isValidName('a'.repeat(32))).toBe(false);
  });

  it('rejects each reserved name', () => {
    expect(RESERVED_NAMES).toEqual(['core', 'shop-challenge', 'practice-path']);
    for (const name of RESERVED_NAMES) {
      expect(isValidName(name), name).toBe(false);
    }
  });
});

describe('derive', () => {
  it('derives every placeholder from a multi-word name', () => {
    expect(derive('quiz-sprint')).toEqual({
      id: 'quiz-sprint',
      pkg: '@dreame/quiz-sprint',
      title: 'Quiz Sprint',
      className: 'quizsprint',
    });
  });

  it('derives every placeholder from a single-word name with digits', () => {
    expect(derive('app2')).toEqual({
      id: 'app2',
      pkg: '@dreame/app2',
      title: 'App2',
      className: 'app2',
    });
  });
});
