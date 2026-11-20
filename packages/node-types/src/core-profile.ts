// The `core` profile (Req 16.10): the shared node types bound to their precompiled validators.

import { defineProfile, type Profile } from '@dreame/runtime';
import { coreNodeTypes } from './core-types.ts';
import { response_choice, response_content, response_outcome, validateManifest } from '../generated/core.validators.js';

export const coreProfile: Profile = defineProfile({
  id: 'core',
  nodeTypes: coreNodeTypes,
  validateSchema: validateManifest,
  responseValidators: {
    content: response_content,
    choice: response_choice,
    outcome: response_outcome,
  },
});
