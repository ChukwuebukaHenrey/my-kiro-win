// Bundled Demo_Manifests (design C12, Architecture Spec §A4 "Bundled demos"). The JSON is
// bundled at build time and validated in the browser before playback. No React.

import giftBundle from '../../../activities/shop-gift-bundle.json';

export interface DemoEntry {
  /** Equals the manifest's `activityId`. */
  readonly id: string;
  /** Link text on the landing page. */
  readonly title: string;
  /** Validated in the browser before playback. */
  readonly json: unknown;
}

export const DEMOS: readonly DemoEntry[] = Object.freeze([
  Object.freeze({ id: 'shop-gift-bundle', title: 'Gift bundle challenge', json: giftBundle }),
]);

const BY_ID: ReadonlyMap<string, DemoEntry> = new Map(DEMOS.map((demo) => [demo.id, demo]));

/** Lookup in a `Map`, so `__proto__` or `toString` never match. */
export function findDemo(id: string | undefined): DemoEntry | undefined {
  if (id === undefined) return undefined;
  return BY_ID.get(id);
}
