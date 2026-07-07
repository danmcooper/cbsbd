import type { Puzzle } from '../../../shared/puzzle';
import { isDeducible } from './deduce';

export type Guess = 'criminal' | 'innocent';

export interface GameState {
  flipped: number[];
  mistakes: number;
  elapsedMs: number;
  lastActionAt: number | null;
  rejectedIndex: number | null;
  completed: boolean;
}

export type GameAction =
  | { type: 'guess'; index: number; guess: Guess; now: number }
  | { type: 'clearRejection' }
  | { type: 'restore'; flipped: number[]; mistakes: number; elapsedMs: number };

const MAX_TICK_MS = 60_000;

export function initialGameState(puzzle: Puzzle): GameState {
  return {
    flipped: [...puzzle.initialReveals],
    mistakes: 0,
    elapsedMs: 0,
    lastActionAt: null,
    rejectedIndex: null,
    completed: false,
  };
}

function tick(state: GameState, now: number): GameState {
  const delta = state.lastActionAt === null ? 0 : Math.min(now - state.lastActionAt, MAX_TICK_MS);
  return { ...state, elapsedMs: state.elapsedMs + Math.max(delta, 0), lastActionAt: now };
}

export function gameReducer(puzzle: Puzzle, state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'guess': {
      if (state.completed || state.flipped.includes(action.index)) return state;
      const person = puzzle.people[action.index];
      const correctTrait = (action.guess === 'criminal') === person.criminal;
      const allowed = correctTrait && isDeducible(puzzle, state.flipped, action.index);
      const timed = tick(state, action.now);
      if (!allowed) {
        // Same rejection for "wrong trait" and "not deducible" - never leak which.
        return { ...timed, mistakes: timed.mistakes + 1, rejectedIndex: action.index };
      }
      const flipped = [...timed.flipped, action.index];
      return {
        ...timed,
        flipped,
        rejectedIndex: null,
        completed: flipped.length === puzzle.people.length,
      };
    }
    case 'clearRejection':
      return state.rejectedIndex === null ? state : { ...state, rejectedIndex: null };
    case 'restore':
      return {
        ...initialGameState(puzzle),
        flipped: [...action.flipped],
        mistakes: action.mistakes,
        elapsedMs: action.elapsedMs,
        completed: action.flipped.length === puzzle.people.length,
      };
  }
}
