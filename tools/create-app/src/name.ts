// App name rule (Req 1.1) and placeholder values (design D3).

export const RESERVED_NAMES: readonly string[] = ['core', 'shop-challenge', 'practice-path'];

const NAME_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const MIN_LENGTH = 2;
const MAX_LENGTH = 31;

export function isValidName(name: string): boolean {
  return (
    name.length >= MIN_LENGTH &&
    name.length <= MAX_LENGTH &&
    NAME_PATTERN.test(name) &&
    !RESERVED_NAMES.includes(name)
  );
}

export interface Placeholders {
  /** `__APP_ID__`: the name itself, e.g. `quiz-sprint`. */
  id: string;
  /** `__APP_PKG__`: `@dreame/<name>`. */
  pkg: string;
  /** `__APP_TITLE__`: words split on `-`, each capitalised, joined with spaces. */
  title: string;
  /** `__APP_CLASS__`: words lower-cased and joined, e.g. `quizsprint`. */
  className: string;
}

export function derive(name: string): Placeholders {
  const words = name.split('-');
  return {
    id: name,
    pkg: `@dreame/${name}`,
    title: words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    className: words.map((w) => w.toLowerCase()).join(''),
  };
}
