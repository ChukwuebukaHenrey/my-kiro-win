// Browser-safe barrel for @dreame/schema. The codegen module imports `ajv` and is exposed only
// through the `./codegen` export, so it is not re-exported here (Requirements 4.1, 14.6).
export * from './ids.ts';
export * from './contracts.ts';
export * from './diagnostics.ts';
export * from './node-type.ts';
export * from './compose.ts';
export * from './parse.ts';
export * from './url.ts';
// Explicit names keep graph.ts internals (GraphIndex, dominators, successorLists, ...) private.
export { validateManifest, validateManifestText, type ValidationResult } from './graph.ts';
