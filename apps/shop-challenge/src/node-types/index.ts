// Node types of the shop-challenge profile in profile order (Wiring_File W5). Imports no generated
// code and no React, so the codegen script and the validate CLI can load it.
import type { AnyNodeType } from '@dreame/runtime';
import { coreNodeTypes } from '@dreame/node-types';
import { collectionSelectNodeType } from './collectionSelect.ts';
import { recommendOutcomeNodeType } from './recommendOutcome.ts';

export * from './collectionSelect.ts';
export * from './recommendOutcome.ts';

export const shopNodeTypes: readonly AnyNodeType[] = [...coreNodeTypes, collectionSelectNodeType, recommendOutcomeNodeType];
