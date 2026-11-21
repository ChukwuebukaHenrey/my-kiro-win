// Component tests for ExternalLinkButton and describeLink (design C8, Requirements 7.1, 7.2, 7.4, 8.1–8.4, 8.6).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ExternalLinkButton } from '../src/components/ExternalLinkButton.tsx';
import { describeLink } from '../src/link.ts';

const AUTHOR_NOTE = "Added by the activity's author, not verified by this app.";
const BLOCKED_NOTE = 'This link was blocked because it is not a safe https link.';
const URL_SAFE = 'https://shop.example.com/bundles?ref=quiz';

describe('describeLink', () => {
  it('returns the hostname for a safe https URL', () => {
    expect(describeLink(URL_SAFE)).toEqual({ safe: true, host: 'shop.example.com' });
  });

  it('marks javascript:, http: and shortener URLs as not safe', () => {
    expect(describeLink('javascript:alert(1)')).toEqual({ safe: false });
    expect(describeLink('http://shop.example.com/')).toEqual({ safe: false });
    expect(describeLink('https://bit.ly/abc')).toEqual({ safe: false });
  });
});

describe('ExternalLinkButton', () => {
  it('shows the label, the destination host and the author note in the default state', () => {
    render(<ExternalLinkButton label="See the bundle" url={URL_SAFE} />);
    const button = screen.getByRole('button', { name: 'See the bundle' });
    expect(button.getAttribute('type')).toBe('button');
    expect(screen.getByText('Opens shop.example.com')).toBeDefined();
    expect(document.getElementById(button.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'Opens shop.example.com',
    );
    expect(screen.getByText(AUTHOR_NOTE)).toBeDefined();
    expect(screen.queryByRole('link')).toBeNull();
    expect(document.activeElement).toBe(document.body);
  });

  it('shows the confirm group with a safe anchor and moves focus to it', async () => {
    const user = userEvent.setup();
    render(<ExternalLinkButton label="See the bundle" url={URL_SAFE} />);
    await user.click(screen.getByRole('button', { name: 'See the bundle' }));

    expect(screen.getByRole('group', { name: 'You are leaving this page for shop.example.com.' })).toBeDefined();
    const anchor = screen.getByRole('link', { name: 'Open shop.example.com' });
    expect(anchor.getAttribute('href')).toBe(URL_SAFE);
    expect(anchor.getAttribute('rel')).toBe('noopener noreferrer');
    expect(anchor.getAttribute('target')).toBe('_blank');
    expect(document.activeElement).toBe(anchor);
    expect(screen.getByRole('button', { name: 'Stay here' })).toBeDefined();
    expect(screen.getByText(AUTHOR_NOTE)).toBeDefined();
  });

  it('returns to the default state and focuses the CTA button on "Stay here"', async () => {
    const user = userEvent.setup();
    render(<ExternalLinkButton label="See the bundle" url={URL_SAFE} />);
    await user.click(screen.getByRole('button', { name: 'See the bundle' }));
    await user.click(screen.getByRole('button', { name: 'Stay here' }));

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('group')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'See the bundle' }));
  });

  it('works from the keyboard', async () => {
    const user = userEvent.setup();
    render(<ExternalLinkButton label="See the bundle" url={URL_SAFE} />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'See the bundle' }));
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Open shop.example.com' }));
  });

  it.each(['javascript:alert(1)', 'http://shop.example.com/bundles'])(
    'blocks %s: no anchor, no button, label and blocked note shown',
    (url) => {
      render(<ExternalLinkButton label="See the bundle" url={url} />);
      expect(screen.queryByRole('link')).toBeNull();
      expect(screen.queryByRole('button')).toBeNull();
      expect(screen.getByText('See the bundle')).toBeDefined();
      expect(screen.getByText(BLOCKED_NOTE)).toBeDefined();
      expect(document.querySelector('a')).toBeNull();
    },
  );

  it('shows a Unicode host in its xn-- form', async () => {
    const user = userEvent.setup();
    render(<ExternalLinkButton label="Visit" url="https://exämple.com/shop" />);
    expect(screen.getByText('Opens xn--exmple-cua.com')).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Visit' }));
    const anchor = screen.getByRole('link', { name: 'Open xn--exmple-cua.com' });
    expect(anchor.getAttribute('href')).toBe('https://exämple.com/shop');
  });

  it('displays a label with markup as text', () => {
    render(<ExternalLinkButton label="<b>x</b>" url={URL_SAFE} />);
    expect(screen.getByRole('button', { name: '<b>x</b>' })).toBeDefined();
    expect(document.querySelector('b')).toBeNull();
  });
});
