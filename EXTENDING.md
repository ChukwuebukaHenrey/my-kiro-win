# Extending DREAME

## Node types

### content

- Node type: `packages/node-types/src/content.ts` (`contentNodeType`, profile `core`)
- View: `packages/ui/src/views/ContentNodeView.tsx`
- Tests: `packages/node-types/test/node-types.test.ts`, `packages/node-types/test/node-types.property.test.ts`

### choice

- Node type: `packages/node-types/src/choice.ts` (`choiceNodeType`, profile `core`)
- View: `packages/ui/src/views/ChoiceNodeView.tsx`
- Tests: `packages/node-types/test/node-types.test.ts`, `packages/node-types/test/node-types.property.test.ts`

### outcome

- Node type: `packages/node-types/src/outcome.ts` (`outcomeNodeType`, profile `core`)
- View: `packages/ui/src/views/OutcomeNodeView.tsx`
- Tests: `packages/node-types/test/node-types.test.ts`, `packages/node-types/test/node-types.property.test.ts`

### collectionSelect

- Node type: `apps/shop-challenge/src/node-types/collectionSelect.ts` (`collectionSelectNodeType`, profile `shop-challenge`)
- View: `apps/shop-challenge/src/views/CollectionSelectNodeView.tsx`
- Tests: `apps/shop-challenge/test/collectionSelect.test.ts`, `apps/shop-challenge/test/collectionSelect.property.test.ts`

### recommendOutcome

- Node type: `apps/shop-challenge/src/node-types/recommendOutcome.ts` (`recommendOutcomeNodeType`, profile `shop-challenge`)
- View: `apps/shop-challenge/src/views/RecommendOutcomeNodeView.tsx`
- Tests: `apps/shop-challenge/test/recommendOutcome.test.ts`, `apps/shop-challenge/test/recommendOutcome.property.test.ts`
