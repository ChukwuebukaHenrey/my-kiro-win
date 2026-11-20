// The shared node types in `core` profile order (Req 16.1). Imports no generated code, so the
// codegen script can import this module before `generated/` exists.

import type { AnyNodeType } from '@dreame/runtime';
import { choiceNodeType } from './choice.ts';
import { contentNodeType } from './content.ts';
import { outcomeNodeType } from './outcome.ts';

export const coreNodeTypes: readonly AnyNodeType[] = [contentNodeType, choiceNodeType, outcomeNodeType];
