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
  const title = await screen.findByText('A tiny test mystery');
  // Fresh puzzles open with the start popup; click through it.
  const start = screen.queryByRole('button', { name: 'Start' });
  if (start) await userEvent.click(start);
  return title;
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

  it('opens a guess modal with the suspect and a Close button that just dismisses', async () => {
    const user = userEvent.setup();
    await renderGame();
    await user.click(screen.getByText('ozan'));
    const modal = screen.getByRole('dialog');
    expect(modal.textContent).toContain('ozan');
    expect(modal.textContent).toContain('pilot');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText(/mistakes: 0/i)).toBeTruthy();
    expect(screen.getAllByRole('group')[2].className).not.toContain('flipped');
  });

  it('flips a deducible card on a correct guess and shows its clue on the card', async () => {
    const user = userEvent.setup();
    await renderGame();
    await user.click(screen.getByText('mira'));
    await user.click(screen.getByRole('button', { name: 'Criminal' }));
    expect(screen.queryByRole('dialog')).toBeNull();
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
    // Completion auto-opens the results dialog; the banner sits behind it.
    expect(screen.getByRole('dialog')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByText(/solved!/i)).toBeTruthy();
  });

  it('shows an error screen with retry when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('gone', { status: 404 })));
    render(<Game date="2026-07-07" />);
    expect(await screen.findByRole('button', { name: /retry/i })).toBeTruthy();
  });
});

describe('corner tags', () => {
  it('clicking the tag corner cycles yellow/red/green/none without opening the modal', async () => {
    const user = userEvent.setup();
    await renderGame();
    const tag = document.querySelectorAll('.tag')[1] as HTMLElement;
    await user.click(tag);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(tag.className).toContain('tag-yellow');
    await user.click(tag);
    expect(tag.className).toContain('tag-red');
    await user.click(tag);
    expect(tag.className).toContain('tag-green');
    await user.click(tag);
    expect(tag.className).toBe('tag');
  });
});

describe('results popup', () => {
  async function solveWithOneWrong() {
    const user = userEvent.setup();
    await renderGame();
    await user.click(screen.getByText('mira'));
    await user.click(screen.getByRole('button', { name: 'Criminal' }));
    await user.click(screen.getByText('ozan'));
    await user.click(screen.getByRole('button', { name: 'Criminal' })); // wrong: ozan is innocent
    await user.click(screen.getByText('ozan'));
    await user.click(screen.getByRole('button', { name: 'Innocent' }));
    await user.click(screen.getByText('lena'));
    await user.click(screen.getByRole('button', { name: 'Criminal' }));
    return user;
  }

  it('opens on completion with date, level, color grid, and solve time', async () => {
    await solveWithOneWrong();
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Jul 7th 2026 (Easy)');
    expect(dialog.textContent).toMatch(/Solved in \d{2}:\d{2}/);
    const cells = dialog.querySelectorAll('.share-cell');
    expect(cells).toHaveLength(4);
    expect(cells[0].className).toContain('share-green'); // banda: initial reveal
    expect(cells[1].className).toContain('share-green'); // mira: clean
    expect(cells[2].className).toContain('share-yellow'); // ozan: had a bad answer
    expect(cells[3].className).toContain('share-green'); // lena: clean
  });

  it('Copy Text puts the emoji summary on the clipboard and Close dismisses', async () => {
    const user = await solveWithOneWrong();
    // userEvent installs its own clipboard stub; spy on it after setup.
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    await user.click(screen.getByRole('button', { name: /copy text/i }));
    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = String(writeText.mock.calls[0]?.[0]);
    expect(copied).toMatch(
      /^I solved the daily #CluesBySam, Jul 7th 2026 \(Easy\), in \d{2}:\d{2}\n🟩🟩\n🟨🟩\nhttps:\/\/cluesbysam\.com$/,
    );
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    // Reopenable via the results button next to the solved banner.
    await user.click(screen.getByRole('button', { name: /results/i }));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});

describe('start popup', () => {
  it('welcomes on a fresh puzzle and dismisses on Start', async () => {
    const user = userEvent.setup();
    render(<Game date="2026-07-07" />);
    await screen.findByText('A tiny test mystery');
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Welcome to Clues by Sam!');
    expect(dialog.textContent).toContain('Jul 7th 2026');
    expect(dialog.textContent).toContain('Difficulty: Easy');
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not show when localStorage already has guesses', async () => {
    localStorage.setItem(
      'cbs:progress:a6f09e2713b2',
      JSON.stringify({ flipped: [0, 1], mistakes: 1, elapsedMs: 5_000, completed: false }),
    );
    render(<Game date="2026-07-07" />);
    await screen.findByText('A tiny test mystery');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
