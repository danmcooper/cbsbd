// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Game from './Game';

const puzzle = {
  formatVersion: 1,
  id: 'a6f09e2713b2',
  date: '2026-07-07',
  title: 'A tiny test mystery',
  difficulty: 'Easy',
  width: 2,
  height: 2,
  initialReveals: [0],
  source: 'cluesbysam.com',
  people: [
    { name: 'banda', profession: 'coder', gender: 'male', criminal: false, clue: 'Start here', origHint: null, paths: [] },
    { name: 'mira', profession: 'chef', gender: 'female', criminal: true, clue: 'Clue of #NAME:1', origHint: null, paths: [[0]] },
    { name: 'ozan', profession: 'pilot', gender: 'male', criminal: false, clue: null, origHint: null, paths: [[0, 1]] },
    { name: 'lena', profession: 'nurse', gender: 'female', criminal: true, clue: null, origHint: null, paths: [[0, 2]] },
  ],
};

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(puzzle), { status: 200 })));
});
afterEach(() => vi.unstubAllGlobals());

async function renderGame() {
  render(<Game date="2026-07-07" />);
  return await screen.findByText('A tiny test mystery');
}

describe('Game', () => {
  it('loads the puzzle and renders the grid with initial reveals flipped, clue on the card', async () => {
    await renderGame();
    const cards = screen.getAllByRole('group');
    expect(cards).toHaveLength(4);
    expect(cards[0].className).toContain('flipped');
    expect(cards[0].textContent).toContain('Start here');
    expect(cards[1].className).not.toContain('flipped');
  });

  it('flips a deducible card on a correct guess and shows its clue on the card', async () => {
    const user = userEvent.setup();
    await renderGame();
    await user.click(screen.getByText('mira'));
    await user.click(screen.getByRole('button', { name: 'Criminal' }));
    const card = screen.getAllByRole('group')[1];
    expect(card.className).toContain('flipped');
    // The clue is shown on mira's own card, so #NAME:1 self-renders as "me".
    expect(card.textContent).toContain('Clue of me');
  });

  it('shows the same generic rejection for wrong trait and non-deducible guesses', async () => {
    const user = userEvent.setup();
    await renderGame();
    await user.click(screen.getByText('mira'));
    await user.click(screen.getByRole('button', { name: 'Innocent' })); // wrong trait
    expect(screen.getByText("That doesn't fit yet.")).toBeTruthy();
    await user.click(screen.getByText('lena'));
    await user.click(screen.getByRole('button', { name: 'Criminal' })); // correct but not deducible
    expect(screen.getByText("That doesn't fit yet.")).toBeTruthy();
    expect(screen.getByText(/mistakes: 2/i)).toBeTruthy();
  });

  it('shows completion with mistakes count', async () => {
    const user = userEvent.setup();
    await renderGame();
    for (const [name, verdict] of [['mira', 'Criminal'], ['ozan', 'Innocent'], ['lena', 'Criminal']] as const) {
      await user.click(screen.getByText(name));
      await user.click(screen.getByRole('button', { name: verdict }));
    }
    expect(screen.getByText(/solved/i)).toBeTruthy();
  });

  it('shows an error screen with retry when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('gone', { status: 404 })));
    render(<Game date="2026-07-07" />);
    expect(await screen.findByRole('button', { name: /retry/i })).toBeTruthy();
  });
});
