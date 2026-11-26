// Bundled Demo_Lessons (design C15 `src/demos.ts`). The JSON is bundled at build time and
// validated in the browser before playback. No React.

import fractions from '../../../activities/practice-fractions.json';

export interface DemoEntry {
  /** Equals the manifest's `activityId`. */
  readonly id: string;
  /** Link text on the landing page. */
  readonly title: string;
  /** Validated in the browser before playback. */
  readonly json: unknown;
}

export const DEMOS: readonly DemoEntry[] = Object.freeze([
  Object.freeze({ id: 'practice-fractions', title: 'Fractions and percentages', json: fractions }),
]);

const BY_ID: ReadonlyMap<string, DemoEntry> = new Map(DEMOS.map((demo) => [demo.id, demo]));

/** Lookup in a `Map`, so `__proto__` or `toString` never match. */
export function findDemo(id: string | undefined): DemoEntry | undefined {
  if (id === undefined) return undefined;
  return BY_ID.get(id);
}
