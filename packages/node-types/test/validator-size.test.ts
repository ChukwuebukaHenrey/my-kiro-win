// Byte budget of the generated `core` Validator_Module (Requirements 3.1, 3.2, 3.3).
// Fails when `pnpm codegen` output grows past either limit, so `pnpm check` rejects a size regression.
// These tests are evidence for the cases listed, not a proof of correctness.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

const MAX_RAW_BYTES = 180_000;
const MAX_GZIP_BYTES = 14_000;

const validatorPath = fileURLToPath(new URL('../generated/core.validators.js', import.meta.url));
const validatorBytes = readFileSync(validatorPath);

describe('core Validator_Module byte budget', () => {
  it(`is at most ${MAX_RAW_BYTES} UTF-8 bytes`, () => {
    expect(validatorBytes.length).toBeLessThanOrEqual(MAX_RAW_BYTES);
  });

  it(`is at most ${MAX_GZIP_BYTES} bytes after gzipSync at the default level`, () => {
    expect(gzipSync(validatorBytes).length).toBeLessThanOrEqual(MAX_GZIP_BYTES);
  });
});
