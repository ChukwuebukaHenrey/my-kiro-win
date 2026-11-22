// Static checks of apps/shop-challenge/index.html (design C12, Requirements 13.11, 14.5).
// The page sets a title and the og:title and og:description meta tags, and has no
// inline script and no inline style, so the CSP needs no exception.
// These tests are evidence for the cases listed, not a proof of correctness.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const htmlPath = fileURLToPath(new URL('../index.html', import.meta.url));
const html = readFileSync(htmlPath, 'utf8');

describe('shop-challenge index.html', () => {
  it('has a non-empty <title>', () => {
    expect(html).toMatch(/<title>[^<]+<\/title>/);
  });

  it('has og:title and og:description meta tags with content', () => {
    expect(html).toMatch(/<meta\s+property="og:title"\s+content="[^"]+"/);
    expect(html).toMatch(/<meta\s+property="og:description"\s+content="[^"]+"/);
  });

  it('has no inline script: every <script> tag has a src attribute', () => {
    const scripts = html.match(/<script\b[^>]*>/gi) ?? [];
    expect(scripts.length).toBeGreaterThan(0);
    for (const tag of scripts) {
      expect(tag).toMatch(/\ssrc="[^"]+"/);
    }
  });

  it('has no <style> element and no style attribute', () => {
    expect(html).not.toMatch(/<style\b/i);
    expect(html).not.toMatch(/\sstyle\s*=/i);
  });
});
