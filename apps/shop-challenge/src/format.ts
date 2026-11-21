/**
 * Price and hint text for the shop views (design C6, D33). Pure, no React.
 */
import type { RuleBreak } from './node-types/bundle-rules.ts';

const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(currency: string): Intl.NumberFormat {
  let formatter = formatters.get(currency);
  if (formatter === undefined) {
    formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    });
    formatters.set(currency, formatter);
  }
  return formatter;
}

/** `Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0, minimumFractionDigits: 0 })`; "$12" for 12 USD. */
export function formatPrice(amount: number, currency: string): string {
  return formatterFor(currency).format(amount);
}

/** "Add 1 more item", "Add 2 more items", "Remove 1 item", "$2 over budget"; `null` for no break or for the ID rules. */
export function hintText(brk: RuleBreak | null, currency: string): string | null {
  if (brk === null) return null;
  switch (brk.rule) {
    case 'too-few':
      return `Add ${brk.missing} more ${brk.missing === 1 ? 'item' : 'items'}`;
    case 'too-many':
      return `Remove ${brk.extra} ${brk.extra === 1 ? 'item' : 'items'}`;
    case 'over-budget':
      return `${formatPrice(brk.over, currency)} over budget`;
    case 'unknown-item':
    case 'repeated-item':
      return null;
  }
}
