// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Archive from './Archive';

const manifest = [
  { date: '2026-07-03', id: 'bbbbbbbbbbbb', difficulty: 'Hard', title: 'Second' },
  { date: '2026-07-01', id: 'aaaaaaaaaaaa', difficulty: 'Easy', title: 'First' },
];

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(manifest), { status: 200 })));
});
afterEach(() => vi.unstubAllGlobals());

describe('Archive', () => {
  it('lists puzzles by month with difficulty, status, and play links', async () => {
    localStorage.setItem(
      'cbs:progress:aaaaaaaaaaaa',
      JSON.stringify({ flipped: [0, 1], mistakes: 0, elapsedMs: 1, completed: true }),
    );
    render(<Archive />);
    expect(await screen.findByText('July 2026')).toBeTruthy();
    const links = screen.getAllByRole('link');
    expect(links[0].getAttribute('href')).toBe('#/play/2026-07-03');
    expect(links[0].textContent).toContain('Hard');
    expect(links[0].textContent).toContain('unplayed');
    expect(links[1].textContent).toContain('done');
  });

  it('shows an error with retry when the manifest fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('gone', { status: 500 })));
    render(<Archive />);
    expect(await screen.findByRole('button', { name: /retry/i })).toBeTruthy();
  });
});
