import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, isHexColor, relativeLuminance } from '../src/theme/contrast.ts';
import {
  BACKGROUND_TOKENS,
  CONTRAST_PAIRS,
  reducedMotionTokens,
  themeTokens,
  type TokenName,
} from '../src/theme/tokens.ts';

const COLOR_TOKEN = /^--dr-(color-[a-z-]+|focus-ring-color)$/;
const tokenNames = Object.keys(themeTokens) as TokenName[];
const colorTokenNames = tokenNames.filter((name) => COLOR_TOKEN.test(name));

describe('contrast helpers', () => {
  it('gives 21 for black on white, in either order', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 10);
    expect(contrastRatio('#ffffff', '#000000')).toBe(contrastRatio('#000000', '#ffffff'));
  });

  it('gives 1 for a colour against itself', () => {
    expect(contrastRatio('#1d4ed8', '#1d4ed8')).toBe(1);
  });

  it('gives relative luminance 0 for black and 1 for white', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 10);
  });

  it('rejects colours that are not #rrggbb', () => {
    expect(() => relativeLuminance('#fff')).toThrow('expected a #rrggbb colour');
    expect(() => relativeLuminance('rgb(0,0,0)')).toThrow('expected a #rrggbb colour');
  });
});

describe('theme tokens (Requirement 6)', () => {
  it('writes every colour token as 6-digit hex', () => {
    expect(colorTokenNames).toContain('--dr-focus-ring-color');
    expect(colorTokenNames.length).toBe(11);
    for (const name of colorTokenNames) {
      expect(isHexColor(themeTokens[name]), `${name}: ${themeTokens[name]}`).toBe(true);
    }
  });

  it('gives every text and background pair a contrast ratio of at least 4.5', () => {
    expect(CONTRAST_PAIRS.length).toBe(8);
    for (const { text, background } of CONTRAST_PAIRS) {
      const ratio = contrastRatio(themeTokens[text], themeTokens[background]);
      expect(ratio, `${text} on ${background}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('gives the focus ring a contrast ratio of at least 3 against every background token', () => {
    expect(BACKGROUND_TOKENS.length).toBe(3);
    for (const background of BACKGROUND_TOKENS) {
      const ratio = contrastRatio(themeTokens['--dr-focus-ring-color'], themeTokens[background]);
      expect(ratio, `focus ring on ${background}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('sets the minimum touch target to at least 44px', () => {
    const value = themeTokens['--dr-touch-target-min'];
    expect(value).toMatch(/^\d+(\.\d+)?px$/);
    expect(Number.parseFloat(value)).toBeGreaterThanOrEqual(44);
  });

  it('sets every motion-duration token to 0ms under reduced motion', () => {
    const motionNames = tokenNames.filter((name) => name.startsWith('--dr-motion-duration-'));
    expect(Object.keys(reducedMotionTokens).sort()).toEqual([...motionNames].sort());
    for (const value of Object.values(reducedMotionTokens)) {
      expect(value).toBe('0ms');
    }
  });
});

// --- Stylesheets (Requirements 6.1, 6.2, 6.5, 6.6, 7.3, 14.1) ---

interface CssBlock {
  readonly prelude: string;
  readonly body: string;
}

const readCss = (name: string): string =>
  readFileSync(new URL(`../src/theme/${name}`, import.meta.url), 'utf8');

const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Splits CSS into its blocks at one nesting level. The stylesheets hold no braces inside strings. */
function parseBlocks(css: string): CssBlock[] {
  const blocks: CssBlock[] = [];
  let depth = 0;
  let start = 0;
  let bodyStart = 0;
  let prelude = '';
  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i];
    if (ch === '{') {
      if (depth === 0) {
        prelude = css.slice(start, i).trim().replace(/\s+/g, ' ');
        bodyStart = i + 1;
      }
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth < 0) throw new Error(`unbalanced "}" at offset ${i}`);
      if (depth === 0) {
        blocks.push({ prelude, body: css.slice(bodyStart, i) });
        start = i + 1;
      }
    }
  }
  if (depth !== 0) throw new Error('unbalanced "{"');
  if (css.slice(start).trim() !== '') throw new Error('text after the last block');
  return blocks;
}

/** Declarations of a block body as [property, value] pairs, whitespace collapsed. */
function declarations(body: string): [string, string][] {
  return body
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .map((part) => {
      const colon = part.indexOf(':');
      if (colon <= 0) throw new Error(`not a declaration: ${part}`);
      return [part.slice(0, colon).trim().toLowerCase(), part.slice(colon + 1).trim().replace(/\s+/g, ' ')];
    });
}

/** Every rule of a stylesheet, with the rules inside at-rule blocks flattened out. */
function allRules(css: string): CssBlock[] {
  return parseBlocks(css).flatMap((block) =>
    block.prelude.startsWith('@') ? allRules(block.body) : [block],
  );
}

function onlyBlock(blocks: readonly CssBlock[], prelude: string): CssBlock {
  const found = blocks.filter((block) => block.prelude === prelude);
  expect(found.length, `blocks with prelude "${prelude}"`).toBe(1);
  return found[0] as CssBlock;
}

function declarationMap(body: string): Record<string, string> {
  const pairs = declarations(body);
  const map = Object.fromEntries(pairs);
  expect(Object.keys(map).length, 'duplicate declarations').toBe(pairs.length);
  return map;
}

const REDUCED_MOTION = '@media (prefers-reduced-motion: reduce)';
const tokensCss = stripComments(readCss('tokens.css'));
const componentsCssRaw = readCss('components.css');
const componentsCss = stripComments(componentsCssRaw);
const componentRules = allRules(componentsCss);

describe('tokens.css (Requirements 6.1, 6.2, 6.6)', () => {
  const blocks = parseBlocks(tokensCss);

  it('holds only the :root block and the reduced-motion block', () => {
    expect(blocks.map((block) => block.prelude)).toEqual([':root', REDUCED_MOTION]);
  });

  it('defines on :root exactly the names and values of themeTokens', () => {
    expect(declarationMap(onlyBlock(blocks, ':root').body)).toEqual(themeTokens);
  });

  it('defines inside the reduced-motion block exactly reducedMotionTokens', () => {
    const inner = parseBlocks(onlyBlock(blocks, REDUCED_MOTION).body);
    expect(inner.map((block) => block.prelude)).toEqual([':root']);
    expect(declarationMap(onlyBlock(inner, ':root').body)).toEqual(reducedMotionTokens);
  });
});

describe('components.css (Requirements 6.5, 7.3, 14.1)', () => {
  const rule = (prelude: string): Record<string, string> =>
    declarationMap(onlyBlock(componentRules, prelude).body);

  it('draws the :focus-visible outline with the three focus tokens', () => {
    const focus = rule(':focus-visible');
    expect(focus['outline']).toContain('var(--dr-focus-ring-width)');
    expect(focus['outline']).toContain('var(--dr-focus-ring-color)');
    expect(focus['outline-offset']).toBe('var(--dr-focus-ring-offset)');
  });

  it('gives .dr-button and .dr-option the minimum touch target as min-height and min-width', () => {
    for (const prelude of ['.dr-button', '.dr-option']) {
      const decls = rule(prelude);
      expect(decls['min-height'], prelude).toBe('var(--dr-touch-target-min)');
      expect(decls['min-width'], prelude).toBe('var(--dr-touch-target-min)');
    }
  });

  it('keeps line breaks in .dr-body with white-space: pre-line', () => {
    expect(rule('.dr-body')['white-space']).toBe('pre-line');
  });

  it('sets every transition and animation duration through a motion-duration token', () => {
    const MOTION_VAR = /var\(--dr-motion-duration-[a-z]+\)/g;
    const TIME_LITERAL = /(^|[^\w-])\d*\.?\d+m?s\b/i;
    const motionDecls = componentRules
      .flatMap((block) => declarations(block.body))
      .filter(([property]) => /^(transition|animation)(-|$)/.test(property));
    expect(motionDecls.length).toBeGreaterThan(0);
    for (const [property, value] of motionDecls) {
      expect(TIME_LITERAL.test(value.replace(MOTION_VAR, '')), `${property}: ${value}`).toBe(false);
      if (/^(transition|animation)(-duration)?$/.test(property) && value !== 'none') {
        const used = value.match(MOTION_VAR) ?? [];
        expect(used.length, `${property}: ${value}`).toBeGreaterThan(0);
        for (const ref of used) {
          expect(Object.keys(reducedMotionTokens), ref).toContain(ref.slice(4, -1));
        }
      }
    }
  });

  it('refers only to defined tokens', () => {
    const refs = [...componentsCss.matchAll(/var\((--[\w-]+)\)/g)].map((match) => match[1]);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(tokenNames as string[], `var(${ref})`).toContain(ref);
    }
  });

  it('loads no resource through url(', () => {
    expect(componentsCssRaw.toLowerCase()).not.toContain('url(');
    expect(tokensCss.toLowerCase()).not.toContain('url(');
  });
});
