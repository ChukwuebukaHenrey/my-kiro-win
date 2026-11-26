// Node types of the practice-path profile in profile order (Wiring_File W5). Imports no generated
// code and no React, so the codegen script and the validate CLI can load it.
import type { AnyNodeType } from '@dreame/runtime';
import { coreNodeTypes } from '@dreame/node-types';
import { recallNodeType } from './recall.ts';
import { reviewQueueNodeType } from './reviewQueue.ts';
import { masterySummaryNodeType } from './masterySummary.ts';

export * from './recall.ts';
export * from './reviewQueue.ts';
export * from './masterySummary.ts';

export const practiceNodeTypes: readonly AnyNodeType[] = [
  ...coreNodeTypes,
  recallNodeType,
  reviewQueueNodeType,
  masterySummaryNodeType,
];
