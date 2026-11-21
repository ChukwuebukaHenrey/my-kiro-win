import type { ContactChannel } from './channel.ts';
import { whatsappChannel } from './whatsapp.ts';
import { telegramChannel } from './telegram.ts';

export const CONTACT_CHANNELS: readonly ContactChannel[] = Object.freeze([
  whatsappChannel,
  telegramChannel,
]);

// Returns the first channel that matches the URL, or undefined when none does
// or the URL cannot be parsed.
export function channelFor(url: string): ContactChannel | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  for (const channel of CONTACT_CHANNELS) {
    if (channel.matches(parsed)) return channel;
  }
  return undefined;
}
