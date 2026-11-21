import type { ContactChannel } from './channel.ts';

export const whatsappChannel: ContactChannel = Object.freeze({
  id: 'whatsapp',
  name: 'WhatsApp',
  matches(url: URL): boolean {
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && (host === 'wa.me' || host === 'api.whatsapp.com');
  },
});
