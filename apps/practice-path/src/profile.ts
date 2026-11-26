// The practice-path profile (Wiring_File W6): the node types bound to their precompiled validators.
import { defineProfile, type Profile } from '@dreame/runtime';
import { practiceNodeTypes } from './node-types/index.ts';
import {
  response_choice,
  response_content,
  response_masterySummary,
  response_outcome,
  response_recall,
  response_reviewQueue,
  validateManifest,
} from '../generated/practice-path.validators.js';

export const PRACTICE_PROFILE_ID = 'practice-path';

export const practiceProfile: Profile = defineProfile({
  id: PRACTICE_PROFILE_ID,
  nodeTypes: practiceNodeTypes,
  validateSchema: validateManifest,
  responseValidators: {
    content: response_content,
    choice: response_choice,
    outcome: response_outcome,
    recall: response_recall,
    reviewQueue: response_reviewQueue,
    masterySummary: response_masterySummary,
  },
});
