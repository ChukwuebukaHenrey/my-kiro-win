import { describe, expect, it } from 'vitest';
import * as ui from '../src/index.ts';
import type { RenderEntry, RenderModule, RenderProps, RenderRegistry } from '../src/index.ts';

const VALUE_EXPORTS = [
  'createRenderRegistry',
  'coreViews',
  'ContentNodeView',
  'ChoiceNodeView',
  'OutcomeNodeView',
  'ExternalLinkButton',
  'NodeRenderer',
  'ActivityPlayer',
  'InvalidActivityView',
  'orderedOptions',
  'describeLink',
  'themeTokens',
  'reducedMotionTokens',
  'contrastRatio',
] as const;

// Compile-time check: `pnpm typecheck` fails if a type export of design C3 is missing.
type TypeExports = [RenderProps, RenderModule, RenderEntry, RenderRegistry];
const typeExportCount: TypeExports['length'] = 4;

describe('@dreame/ui public barrel (design C3, Requirements 12.1, 12.2, 13.7)', () => {
  it.each(VALUE_EXPORTS)('exports %s', (name) => {
    expect(ui[name]).toBeDefined();
  });

  it('exports exactly the value names of design C3', () => {
    expect(Object.keys(ui).sort()).toEqual([...VALUE_EXPORTS].sort());
  });

  it('exports the four render types', () => {
    expect(typeExportCount).toBe(4);
  });
});
