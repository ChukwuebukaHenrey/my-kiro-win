import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('dom project environment', () => {
  it('transforms JSX and renders it into jsdom', () => {
    render(<p>ok</p>);
    const el = screen.getByText('ok');
    expect(el.tagName).toBe('P');
  });
});
