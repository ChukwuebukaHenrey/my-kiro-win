# Fixtures

`broken-dangling-edge.json` is invalid on purpose. One edge points to a node ID (`finish`) that no node has, so the validator reports `refs/dangling-ref`. Tests use this file to check that the validator catches that error.
