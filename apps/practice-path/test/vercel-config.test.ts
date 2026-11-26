// Static checks of apps/practice-path/vercel.json (design C17, Requirements 20.3, 20.4, 20.6).
// The file sets the install command, build command and output directory, rewrites every
// path to /index.html, sends four security headers, and sets no env, build or buildEnv key.
// The comparison of header values with Architecture Spec §A3 is Property 20.
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

const CSP_VALUE =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

describe('practice-path vercel.json', () => {
  it('sets the install command, build command and output directory of design C17', () => {
    expect(config['installCommand']).toBe('pnpm install --frozen-lockfile');
    expect(config['buildCommand']).toBe('pnpm run build');
    expect(config['outputDirectory']).toBe('dist');
  });

  it('has one rewrite from /(.*) to /index.html', () => {
    const rewrites = config['rewrites'] as Rewrite[];
    expect(rewrites).toEqual([{ source: '/(.*)', destination: '/index.html' }]);
  });

  it('has one header rule for /(.*) with the four headers and their values', () => {
    const rules = config['headers'] as HeaderRule[];
    expect(rules).toHaveLength(1);
    const rule = rules[0];
    expect(rule?.source).toBe('/(.*)');
    expect(rule?.headers).toEqual([
      { key: 'Content-Security-Policy', value: CSP_VALUE },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ]);
  });

  it('has no env, build or buildEnv key', () => {
    expect(config).not.toHaveProperty('env');
    expect(config).not.toHaveProperty('build');
    expect(config).not.toHaveProperty('buildEnv');
  });
});
