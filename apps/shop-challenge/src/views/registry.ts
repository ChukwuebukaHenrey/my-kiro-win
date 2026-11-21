// Views of the shop-challenge profile (Wiring_File W7), in profile order.
import { ChoiceNodeView, ContentNodeView, createRenderRegistry, OutcomeNodeView, type RenderRegistry } from '@dreame/ui';
import { CollectionSelectNodeView } from './CollectionSelectNodeView.tsx';
import { RecommendOutcomeNodeView } from './RecommendOutcomeNodeView.tsx';

export { CollectionSelectNodeView, RecommendOutcomeNodeView };

export const shopViews: RenderRegistry = createRenderRegistry([
  { type: 'content', Render: ContentNodeView },
  { type: 'choice', Render: ChoiceNodeView },
  { type: 'outcome', Render: OutcomeNodeView },
  { type: 'collectionSelect', Render: CollectionSelectNodeView },
  { type: 'recommendOutcome', Render: RecommendOutcomeNodeView },
]);
