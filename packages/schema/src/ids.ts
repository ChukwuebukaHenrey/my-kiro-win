// Limits and ID patterns shared by the schema, the graph validator and the runtime.
// Text limits are measured in UTF-16 code units, as returned by `string.length` (Decision D6).

/** UTF-8 byte cap applied before `JSON.parse` (Brief C2, security.md). */
export const MAX_MANIFEST_JSON_BYTES = 65_536;

export const HARD_LIMITS = {
  maxNodes: 200, // design value, Decision D10
  maxTransitions: 1_000, // design value
  maxEdgesPerNode: 16, // design value
  maxVariables: 32, // design value
  maxCondDepth: 8, // Brief B2
  maxCondArgs: 8, // design value
  maxOptions: 8, // design value
  maxEffectsPerOption: 8, // design value
  maxTextLength: 2_000, // design value (UTF-16 code units, Decision D6)
  maxDiagnostics: 50, // design value
} as const;

/** No leading `_`, so `__proto__` and other prototype keys never match. */
export const NODE_ID_PATTERN = '^[A-Za-z][A-Za-z0-9_-]{0,63}$';
export const VAR_ID_PATTERN = '^[A-Za-z][A-Za-z0-9_]{0,31}$';
export const TYPE_NAME_PATTERN = '^[a-z][A-Za-z0-9]{0,31}$';
export const ACTIVITY_ID_PATTERN = '^[a-z0-9][a-z0-9-]{0,63}$';
export const THEME_PATTERN = '^[a-z0-9-]{1,32}$';
export const DATE_PATTERN = '^[0-9]{4}-[0-9]{2}-[0-9]{2}$';
export const HTTPS_PREFIX_PATTERN = '^https://';
