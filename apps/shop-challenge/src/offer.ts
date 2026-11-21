// Offer end date helpers for the app shell (design C12, Requirement 13.7). Pure, no React.

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** `YYYY-MM-DD` of `d` in the device's local time zone. */
export function localDateString(d: Date): string {
  return `${String(d.getFullYear()).padStart(4, '0')}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** `true` when `validUntil` is set and is earlier than `today`; both are `YYYY-MM-DD`, so string order is date order. */
export function isOfferEnded(validUntil: string | undefined, today: string): boolean {
  return validUntil !== undefined && validUntil < today;
}
