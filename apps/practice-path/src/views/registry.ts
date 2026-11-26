// Views of the practice-path profile (Wiring_File W7), in profile order.
import { ChoiceNodeView, ContentNodeView, createRenderRegistry, OutcomeNodeView, type RenderRegistry } from '@dreame/ui';
import { MasterySummaryNodeView } from './MasterySummaryNodeView.tsx';
import { RecallNodeView } from './RecallNodeView.tsx';
import { ReviewQueueNodeView } from './ReviewQueueNodeView.tsx';

export { MasterySummaryNodeView, RecallNodeView, ReviewQueueNodeView };

export const practiceViews: RenderRegistry = createRenderRegistry([
  { type: 'content', Render: ContentNodeView },
  { type: 'choice', Render: ChoiceNodeView },
  { type: 'outcome', Render: OutcomeNodeView },
  { type: 'recall', Render: RecallNodeView },
  { type: 'reviewQueue', Render: ReviewQueueNodeView },
  { type: 'masterySummary', Render: MasterySummaryNodeView },
]);
