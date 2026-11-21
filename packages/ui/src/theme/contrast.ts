/**
 * WCAG 2.2 relative luminance and contrast ratio for `#rrggbb` colours
 * (design C5, Requirements 6.3, 6.4).
 */

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** True when `value` is a 6-digit hex colour such as `#1d4ed8`. */
export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

function channelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * WCAG 2.2 relative luminance of a `#rrggbb` colour, from 0 (black) to 1 (white).
 * Throws on any other format.
 */
export function relativeLuminance(hex: string): number {
  if (!isHexColor(hex)) {
    throw new Error(`relativeLuminance: expected a #rrggbb colour, got "${hex}"`);
  }
  const r = channelToLinear(Number.parseInt(hex.slice(1, 3), 16));
  const g = channelToLinear(Number.parseInt(hex.slice(3, 5), 16));
  const b = channelToLinear(Number.parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG 2.2 contrast ratio `(L1 + 0.05) / (L2 + 0.05)`, where L1 is the lighter
 * of the two colours. The result is between 1 and 21 and does not depend on
 * argument order.
 */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}
