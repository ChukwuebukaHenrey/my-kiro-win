import type { ContactChannel } from './channel.ts';

export const telegramChannel: ContactChannel = Object.freeze({
  id: 'telegram',
  name: 'Telegram',
  matches(url: URL): boolean {
    return url.protocol === 'https:' && url.hostname.toLowerCase() === 't.me';
  },
});
