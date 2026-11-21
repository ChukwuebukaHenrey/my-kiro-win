// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CONTACT_CHANNELS, channelFor } from '../src/contact/channels.ts';

describe('contact channels', () => {
  it.each(['https://wa.me/12125550142', 'https://api.whatsapp.com/send?phone=1', 'https://WA.ME/1'])(
    'WhatsApp matches %s',
    (url) => {
      expect(channelFor(url)?.id).toBe('whatsapp');
    },
  );

  it('Telegram matches https://t.me/dreame_demo_shop', () => {
    expect(channelFor('https://t.me/dreame_demo_shop')?.id).toBe('telegram');
  });

  it.each([
    'https://wa.me.evil.com/x',
    'https://evilwa.me/x',
    'https://t.me.example.org/x',
    'http://t.me/x',
    'https://example.com',
  ])('no channel matches %s', (url) => {
    expect(channelFor(url)).toBeUndefined();
  });

  it('returns undefined for unparsable input', () => {
    expect(channelFor('not a url')).toBeUndefined();
  });

  it('lists WhatsApp then Telegram', () => {
    expect(CONTACT_CHANNELS.map((c) => c.id)).toEqual(['whatsapp', 'telegram']);
  });
});

describe('src/contact folder scan', () => {
  const dir = fileURLToPath(new URL('../src/contact/', import.meta.url));
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));

  it('finds the contact files', () => {
    expect(files).toEqual(expect.arrayContaining(['channel.ts', 'channels.ts', 'whatsapp.ts', 'telegram.ts']));
  });

  it('each channel module imports only ./channel.ts', () => {
    for (const file of files) {
      if (file === 'channel.ts' || file === 'channels.ts') continue;
      const text = readFileSync(join(dir, file), 'utf8');
      const imports = text.match(/^\s*import\s[^;]*;/gm) ?? [];
      expect(imports, file).toHaveLength(1);
      expect(imports[0], file).toMatch(/from '\.\/channel\.ts';$/);
    }
  });

  it('no file imports react or makes a network call', () => {
    const banned = ["from 'react'", "from 'react-dom'", 'fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket'];
    for (const file of files) {
      const text = readFileSync(join(dir, file), 'utf8');
      for (const word of banned) {
        expect(text.includes(word), `${file} contains ${word}`).toBe(false);
      }
    }
  });
});
