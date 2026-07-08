import { describe, expect, it } from 'vitest';
import type { Puzzle } from '../../../shared/puzzle';
import { isDeducible } from './deduce';
import { gameReducer, initialGameState, type GameState } from './reducer';

// 2x2 fixture matching the extractor fixture: 0=banda(innocent, revealed),
// 1=mira(criminal, needs [0]), 2=ozan(innocent, needs [0,1] or [3]), 3=lena(criminal, needs [0,2])
const puzzle: Puzzle = {
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
    { name: 'banda', profession: 'coder', gender: 'male', criminal: false, clue: null, origHint: null, paths: [] },
    { name: 'mira', profession: 'chef', gender: 'female', criminal: true, clue: 'c1', origHint: null, paths: [[0]] },
    { name: 'ozan', profession: 'pilot', gender: 'male', criminal: false, clue: 'c2', origHint: null, paths: [[0, 1], [3]] },
    { name: 'lena', profession: 'nurse', gender: 'female', criminal: true, clue: 'c3', origHint: null, paths: [[0, 2]] },
  ],
};

const guess = (s: GameState, index: number, g: 'criminal' | 'innocent', now = 1000) =>
  gameReducer(puzzle, s, { type: 'guess', index, guess: g, now });

describe('isDeducible', () => {
  it('is true when some path is fully flipped, false otherwise', () => {
    expect(isDeducible(puzzle, [0], 1)).toBe(true);
    expect(isDeducible(puzzle, [], 1)).toBe(false);
    expect(isDeducible(puzzle, [0], 2)).toBe(false);
    expect(isDeducible(puzzle, [3], 2)).toBe(true); // alternative path
  });

  it('paths [] is never deducible; paths null always is', () => {
    expect(isDeducible(puzzle, [0, 1, 2, 3], 0)).toBe(false);
    const loose = { ...puzzle, people: puzzle.people.map((p) => ({ ...p, paths: null })) };
    expect(isDeducible(loose, [], 3)).toBe(true);
  });
});

describe('gameReducer', () => {
  it('starts with initialReveals flipped', () => {
    const s = initialGameState(puzzle);
    expect(s.flipped).toEqual([0]);
    expect(s.mistakes).toBe(0);
    expect(s.completed).toBe(false);
  });

  it('flips on a correct guess of a deducible card', () => {
    const s = guess(initialGameState(puzzle), 1, 'criminal');
    expect(s.flipped).toEqual([0, 1]);
    expect(s.mistakes).toBe(0);
    expect(s.rejectedIndex).toBeNull();
  });

  it('rejects a wrong trait on a deducible card: mistake, no flip', () => {
    const s = guess(initialGameState(puzzle), 1, 'innocent');
    expect(s.flipped).toEqual([0]);
    expect(s.mistakes).toBe(1);
    expect(s.rejectedIndex).toBe(1);
  });

  it('rejects a CORRECT trait on a non-deducible card identically (no-guessing rule)', () => {
    const s = guess(initialGameState(puzzle), 3, 'criminal');
    expect(s.flipped).toEqual([0]);
    expect(s.mistakes).toBe(1);
    expect(s.rejectedIndex).toBe(3);
  });

  it('ignores guesses on already-flipped cards and after completion', () => {
    const s0 = initialGameState(puzzle);
    expect(guess(s0, 0, 'innocent')).toBe(s0);
    const done = { ...s0, completed: true };
    expect(guess(done, 1, 'criminal')).toBe(done);
  });

  it('detects completion when all cards are flipped', () => {
    let s = initialGameState(puzzle);
    s = guess(s, 1, 'criminal');
    s = guess(s, 2, 'innocent');
    s = guess(s, 3, 'criminal');
    expect(s.flipped).toEqual([0, 1, 2, 3]);
    expect(s.completed).toBe(true);
  });

  it('accumulates elapsed time between actions, capping idle gaps at 60s', () => {
    let s = initialGameState(puzzle);
    s = guess(s, 1, 'criminal', 5_000); // first action: starts the clock, no elapsed yet
    expect(s.elapsedMs).toBe(0);
    s = guess(s, 2, 'innocent', 15_000);
    expect(s.elapsedMs).toBe(10_000);
    s = guess(s, 3, 'criminal', 500_000); // 485s idle gap capped at 60s
    expect(s.elapsedMs).toBe(70_000);
  });

  it('clearRejection resets rejectedIndex; restore rebuilds state', () => {
    const rejected = guess(initialGameState(puzzle), 1, 'innocent');
    expect(gameReducer(puzzle, rejected, { type: 'clearRejection' }).rejectedIndex).toBeNull();
    const restored = gameReducer(puzzle, initialGameState(puzzle), {
      type: 'restore', flipped: [0, 1], mistakes: 2, elapsedMs: 9_000,
    });
    expect(restored).toMatchObject({ flipped: [0, 1], mistakes: 2, elapsedMs: 9_000, completed: false });
  });
});

describe('tags', () => {
  it('cycleTag cycles none -> yellow -> red -> green -> none', () => {
    let s = initialGameState(puzzle);
    s = gameReducer(puzzle, s, { type: 'cycleTag', index: 2 });
    expect(s.tags).toEqual({ 2: 'yellow' });
    s = gameReducer(puzzle, s, { type: 'cycleTag', index: 2 });
    expect(s.tags).toEqual({ 2: 'red' });
    s = gameReducer(puzzle, s, { type: 'cycleTag', index: 2 });
    expect(s.tags).toEqual({ 2: 'green' });
    s = gameReducer(puzzle, s, { type: 'cycleTag', index: 2 });
    expect(s.tags).toEqual({});
  });

  it('tags are independent per card and survive restore', () => {
    let s = initialGameState(puzzle);
    s = gameReducer(puzzle, s, { type: 'cycleTag', index: 1 });
    s = gameReducer(puzzle, s, { type: 'cycleTag', index: 3 });
    s = gameReducer(puzzle, s, { type: 'cycleTag', index: 3 });
    expect(s.tags).toEqual({ 1: 'yellow', 3: 'red' });
    const restored = gameReducer(puzzle, initialGameState(puzzle), {
      type: 'restore', flipped: [0], mistakes: 0, elapsedMs: 0, tags: { 2: 'green' },
    });
    expect(restored.tags).toEqual({ 2: 'green' });
  });
});
