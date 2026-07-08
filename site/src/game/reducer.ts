import type { Puzzle } from '../../../shared/puzzle';
import { isDeducible } from './deduce';

export type Guess = 'criminal' | 'innocent';

export type Tag = 'yellow' | 'red' | 'green';

export interface GameState {
  flipped: number[];
  mistakes: number;
  elapsedMs: number;
  lastActionAt: number | null;
  rejectedIndex: number | null;
  completed: boolean;
  tags: Record<number, Tag>;
  /** Cards that ever received a bad answer (for the results grid). */
  wrong: number[];
  /** Cards whose clue the player marked as used (dimmed). */
  consumed: number[];
}

export type GameAction =
  | { type: 'start'; now: number }
  | { type: 'pause'; now: number }
  | { type: 'tick'; now: number }
  | { type: 'reset' }
  | { type: 'guess'; index: number; guess: Guess; now: number }
  | { type: 'clearRejection' }
  | { type: 'cycleTag'; index: number }
  | { type: 'toggleConsumed'; index: number }
  | {
      type: 'restore';
      flipped: number[];
      mistakes: number;
      elapsedMs: number;
      tags?: Record<number, Tag>;
      wrong?: number[];
      consumed?: number[];
    };

const TAG_CYCLE: (Tag | undefined)[] = [undefined, 'yellow', 'red', 'green'];

const MAX_TICK_MS = 60_000;

export function initialGameState(puzzle: Puzzle): GameState {
  return {
    flipped: [...puzzle.initialReveals],
    mistakes: 0,
    elapsedMs: 0,
    lastActionAt: null,
    rejectedIndex: null,
    completed: false,
    tags: {},
    wrong: [],
    consumed: [],
  };
}

/** Elapsed time as of `now`, using the same capped-idle rule the reducer applies. */
export function liveElapsedMs(state: GameState, now: number): number {
  if (state.completed || state.lastActionAt === null) return state.elapsedMs;
  return state.elapsedMs + Math.max(0, Math.min(now - state.lastActionAt, MAX_TICK_MS));
}

function tick(state: GameState, now: number): GameState {
  const delta = state.lastActionAt === null ? 0 : Math.min(now - state.lastActionAt, MAX_TICK_MS);
  return { ...state, elapsedMs: state.elapsedMs + Math.max(delta, 0), lastActionAt: now };
}

export function gameReducer(puzzle: Puzzle, state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'start':
      return state.lastActionAt === null ? { ...state, lastActionAt: action.now } : state;
    case 'pause':
      // Fold accrued time in, then stop the clock until the next start.
      return state.lastActionAt === null ? state : { ...tick(state, action.now), lastActionAt: null };
    case 'tick':
      // Periodic fold while the page is visible, so elapsed time persists.
      if (state.lastActionAt === null || state.completed) return state;
      return tick(state, action.now);
    case 'reset':
      return initialGameState(puzzle);
    case 'guess': {
      if (state.completed || state.flipped.includes(action.index)) return state;
      const person = puzzle.people[action.index];
      const correctTrait = (action.guess === 'criminal') === person.criminal;
      const allowed = correctTrait && isDeducible(puzzle, state.flipped, action.index);
      const timed = tick(state, action.now);
      if (!allowed) {
        // Same rejection for "wrong trait" and "not deducible" - never leak which.
        const wrong = timed.wrong.includes(action.index) ? timed.wrong : [...timed.wrong, action.index];
        return { ...timed, mistakes: timed.mistakes + 1, rejectedIndex: action.index, wrong };
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
    case 'cycleTag': {
      const next = TAG_CYCLE[(TAG_CYCLE.indexOf(state.tags[action.index]) + 1) % TAG_CYCLE.length];
      const tags = { ...state.tags };
      if (next === undefined) delete tags[action.index];
      else tags[action.index] = next;
      return { ...state, tags };
    }
    case 'toggleConsumed':
      return {
        ...state,
        consumed: state.consumed.includes(action.index)
          ? state.consumed.filter((i) => i !== action.index)
          : [...state.consumed, action.index],
      };
    case 'restore':
      return {
        ...initialGameState(puzzle),
        flipped: [...action.flipped],
        mistakes: action.mistakes,
        elapsedMs: action.elapsedMs,
        completed: action.flipped.length === puzzle.people.length,
        tags: { ...action.tags },
        wrong: [...(action.wrong ?? [])],
        consumed: [...(action.consumed ?? [])],
      };
  }
}
