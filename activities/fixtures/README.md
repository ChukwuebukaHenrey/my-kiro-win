# Fixtures

`broken-dangling-edge.json` is invalid on purpose. One edge points to a node ID (`finish`) that no node has, so the validator reports `refs/dangling-ref`. Tests use this file to check that the validator catches that error.

`broken-shop-over-budget.json` is invalid on purpose. Its `collectionSelect` node needs at least 2 Items under a budget of 10 USD, but its only two Items cost 15 and 20 USD, so the validator reports `conditions/select-unsatisfiable`. Tests use this file to check that the validator catches that error.

`broken-practice-answer-key.json` is invalid on purpose. Its `recall` node `q2` sets `correctOptionId` to `zz`, which names none of its options, so the validator reports `conditions/dangling-ref`. Tests use this file to check that the validator catches that error.
