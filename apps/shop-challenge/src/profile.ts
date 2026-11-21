// The shop-challenge profile (Wiring_File W6): the node types bound to their precompiled validators.
import { defineProfile, type Profile } from '@dreame/runtime';
import { shopNodeTypes } from './node-types/index.ts';
import {
  response_choice,
  response_collectionSelect,
  response_content,
  response_outcome,
  response_recommendOutcome,
  validateManifest,
} from '../generated/shop-challenge.validators.js';

export const SHOP_PROFILE_ID = 'shop-challenge';

export const shopProfile: Profile = defineProfile({
  id: SHOP_PROFILE_ID,
  nodeTypes: shopNodeTypes,
  validateSchema: validateManifest,
  responseValidators: {
    content: response_content,
    choice: response_choice,
    outcome: response_outcome,
    collectionSelect: response_collectionSelect,
    recommendOutcome: response_recommendOutcome,
  },
});
