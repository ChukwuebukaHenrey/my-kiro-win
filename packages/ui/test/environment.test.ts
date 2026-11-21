import { describe, expect, it } from 'vitest';

describe('node project environment', () => {
  it('runs .test.ts files without a DOM', () => {
    expect(typeof document).toBe('undefined');
  });
});
