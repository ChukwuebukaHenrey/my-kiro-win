// A messaging service the result view can name next to a contact link (design C8b).
export interface ContactChannel {
  readonly id: string;
  readonly name: string;
  matches(url: URL): boolean;
}
