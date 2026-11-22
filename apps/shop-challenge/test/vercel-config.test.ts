// Static checks of apps/shop-challenge/vercel.json (design C14, Requirements 15.3, 15.4, 15.5).
// The file sets the install command, build command and output directory, rewrites every
// path to /index.html, sends four security headers, and sets no env, build or buildEnv key.
// The byte-equal comparison of header values with Architecture Spec §A3 is Property 11.
// These tests are evidence for the cases listed, not a proof of correctness.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

interface HeaderEntry {
  key: string;
  value: string;
}

interface HeaderRule {
  source: string;
  headers: HeaderEntry[];
}

interface Rewrite {
  source: string;
  destination: string;
}

const configPath = fileURLToPath(new URL('../vercel.json', import.meta.url));
const config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;

describe('shop-challenge vercel.json', () => {
  it('sets the install command, build command and output directory of design C14', () => {
    expect(config['installCommand']).toBe('pnpm install --frozen-lockfile');
    expect(config['buildCommand']).toBe('pnpm run build');
    expect(config['outputDirectory']).toBe('dist');
  });

  it('has one rewrite from /(.*) to /index.html', () => {
    const rewrites = config['rewrites'] as Rewrite[];
    expect(rewrites).toEqual([{ source: '/(.*)', destination: '/index.html' }]);
  });

  it('has one header rule for /(.*) with the four security header keys', () => {
    const rules = config['headers'] as HeaderRule[];
    expect(rules).toHaveLength(1);
    const rule = rules[0];
    expect(rule?.source).toBe('/(.*)');
    expect(rule?.headers.map((h) => h.key)).toEqual([
      'Content-Security-Policy',
      'Referrer-Policy',
      'X-Content-Type-Options',
      'Permissions-Policy',
    ]);
    for (const h of rule?.headers ?? []) {
      expect(typeof h.value).toBe('string');
      expect(h.value.length).toBeGreaterThan(0);
    }
  });

  it('has no env, build or buildEnv key', () => {
    expect(config).not.toHaveProperty('env');
    expect(config).not.toHaveProperty('build');
    expect(config).not.toHaveProperty('buildEnv');
  });
});
