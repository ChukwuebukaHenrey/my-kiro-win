/**
 * Theme tokens (design C5, Requirement 6). `tokens.css` defines the same names
 * and values as CSS custom properties; the token test compares the two.
 * The palette is a neutral grey and blue set chosen for this project, with no
 * third-party brand colours (Requirement 6.7).
 */

export const themeTokens = {
  '--dr-color-bg': '#ffffff',
  '--dr-color-page': '#f4f6fb',
  '--dr-color-surface': '#f4f4f5',
  '--dr-color-notice-bg': '#fef3c7',
  '--dr-color-text': '#18181b',
  '--dr-color-text-muted': '#52525b',
  '--dr-color-accent': '#1d4ed8',
  '--dr-color-accent-strong': '#1e3a8a',
  '--dr-color-accent-soft': '#e7eefe',
  '--dr-color-on-accent': '#ffffff',
  '--dr-color-success': '#166534',
  '--dr-color-success-bg': '#dcfce7',
  '--dr-color-warning': '#b45309',
  '--dr-color-danger': '#b91c1c',
  '--dr-color-danger-bg': '#fee2e2',
  '--dr-color-notice-text': '#78350f',
  '--dr-color-border': '#71717a',
  '--dr-color-border-soft': '#d4d4d8',
  '--dr-focus-ring-color': '#1d4ed8',
  '--dr-focus-ring-width': '3px',
  '--dr-focus-ring-offset': '2px',
  '--dr-touch-target-min': '44px',
  '--dr-space-1': '4px',
  '--dr-space-2': '8px',
  '--dr-space-3': '12px',
  '--dr-space-4': '16px',
  '--dr-space-6': '24px',
  '--dr-space-8': '32px',
  '--dr-space-12': '48px',
  '--dr-radius-sm': '6px',
  '--dr-radius-md': '12px',
  '--dr-radius-lg': '20px',
  '--dr-radius-pill': '999px',
  '--dr-shadow-card': '0 1px 2px rgba(24, 24, 27, 0.06), 0 8px 24px rgba(24, 24, 27, 0.08)',
  '--dr-shadow-raised': '0 2px 6px rgba(29, 78, 216, 0.25)',
  '--dr-content-max-width': '44rem',
  '--dr-control-size': '1.25rem',
  '--dr-line-height': '1.5',
  '--dr-font-weight-bold': '650',
  '--dr-font-family': 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  '--dr-font-size-sm': '0.875rem',
  '--dr-font-size-base': '1rem',
  '--dr-font-size-lg': '1.25rem',
  '--dr-font-size-xl': '1.5rem',
  '--dr-font-size-2xl': '2rem',
  '--dr-motion-duration-fast': '120ms',
  '--dr-motion-duration-base': '200ms',
  '--dr-motion-duration-slow': '360ms',
} as const satisfies Readonly<Record<`--dr-${string}`, string>>;

export type TokenName = keyof typeof themeTokens;

/** Motion tokens under `@media (prefers-reduced-motion: reduce)` (Requirement 6.6). */
export const reducedMotionTokens = {
  '--dr-motion-duration-fast': '0ms',
  '--dr-motion-duration-base': '0ms',
  '--dr-motion-duration-slow': '0ms',
} as const satisfies Readonly<Partial<Record<TokenName, string>>>;

/** Tokens used as backgrounds; the focus ring must reach 3:1 on each (Requirement 6.4). */
export const BACKGROUND_TOKENS = [
  '--dr-color-bg',
  '--dr-color-page',
  '--dr-color-surface',
  '--dr-color-notice-bg',
  '--dr-color-accent-soft',
  '--dr-color-success-bg',
  '--dr-color-danger-bg',
] as const satisfies readonly TokenName[];

/** Text and background pairs used together; each must reach 4.5:1 (Requirement 6.3). */
export const CONTRAST_PAIRS: readonly { readonly text: TokenName; readonly background: TokenName }[] = [
  { text: '--dr-color-text', background: '--dr-color-bg' },
  { text: '--dr-color-text', background: '--dr-color-surface' },
  { text: '--dr-color-text-muted', background: '--dr-color-bg' },
  { text: '--dr-color-text-muted', background: '--dr-color-surface' },
  { text: '--dr-color-on-accent', background: '--dr-color-accent' },
  { text: '--dr-color-danger', background: '--dr-color-bg' },
  { text: '--dr-color-danger', background: '--dr-color-surface' },
  { text: '--dr-color-notice-text', background: '--dr-color-notice-bg' },
  { text: '--dr-color-text', background: '--dr-color-page' },
  { text: '--dr-color-text-muted', background: '--dr-color-page' },
  { text: '--dr-color-accent', background: '--dr-color-bg' },
  { text: '--dr-color-accent', background: '--dr-color-page' },
  { text: '--dr-color-accent-strong', background: '--dr-color-bg' },
  { text: '--dr-color-accent-strong', background: '--dr-color-accent-soft' },
  { text: '--dr-color-text', background: '--dr-color-accent-soft' },
  { text: '--dr-color-text-muted', background: '--dr-color-accent-soft' },
  { text: '--dr-color-on-accent', background: '--dr-color-accent-strong' },
  { text: '--dr-color-success', background: '--dr-color-success-bg' },
  { text: '--dr-color-text', background: '--dr-color-success-bg' },
  { text: '--dr-color-danger', background: '--dr-color-danger-bg' },
  { text: '--dr-color-text', background: '--dr-color-danger-bg' },
];
