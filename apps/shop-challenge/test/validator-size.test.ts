// Byte budget of the generated Shop_Validator_Module (Requirements 4.4, 4.5; design C3, D44).
// Fails when `pnpm codegen` output grows past either limit, so `pnpm check` rejects a size regression.
// Limits are the first measurement (231,675 raw, 17,231 gzip) × 1.10, rounded up (design C3 table).
// These tests are evidence for the cases listed, not a proof of correctness.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

const MAX_RAW_BYTES = 255_000;
const MAX_GZIP_BYTES = 19_000;

const validatorPath = fileURLToPath(
  new URL('../generated/shop-challenge.validators.js', import.meta.url),
);
const validatorBytes = readFileSync(validatorPath);

describe('shop-challenge Validator_Module byte budget', () => {
  it(`is at most ${MAX_RAW_BYTES} UTF-8 bytes`, () => {
    expect(validatorBytes.length).toBeLessThanOrEqual(MAX_RAW_BYTES);
  });

  it(`is at most ${MAX_GZIP_BYTES} bytes after gzipSync at the default level`, () => {
    expect(gzipSync(validatorBytes).length).toBeLessThanOrEqual(MAX_GZIP_BYTES);
  });
});
