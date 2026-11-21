import { createRenderRegistry, type RenderRegistry } from './render.ts';
import { ContentNodeView } from './views/ContentNodeView.tsx';
import { ChoiceNodeView } from './views/ChoiceNodeView.tsx';
import { OutcomeNodeView } from './views/OutcomeNodeView.tsx';

export { ContentNodeView, ChoiceNodeView, OutcomeNodeView };

export const coreViews: RenderRegistry = createRenderRegistry([
  { type: 'content', Render: ContentNodeView },
  { type: 'choice', Render: ChoiceNodeView },
  { type: 'outcome', Render: OutcomeNodeView },
]);
