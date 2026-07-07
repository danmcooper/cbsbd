import { useEffect, useReducer } from 'react';
import type { Puzzle } from '../../../shared/puzzle';
import { gameReducer, initialGameState, type GameAction, type GameState } from './reducer';
import { loadProgress, saveProgress } from './storage';

export function useGameState(puzzle: Puzzle): {
  state: GameState;
  dispatch: (action: GameAction) => void;
} {
  const [state, dispatch] = useReducer(
    (s: GameState, a: GameAction) => gameReducer(puzzle, s, a),
    puzzle,
    (p: Puzzle): GameState => {
      const saved = loadProgress(p.id);
      const initial = initialGameState(p);
      if (!saved) return initial;
      return gameReducer(p, initial, { type: 'restore', ...saved });
    },
  );

  useEffect(() => {
    saveProgress(puzzle.id, {
      flipped: state.flipped,
      mistakes: state.mistakes,
      elapsedMs: state.elapsedMs,
      completed: state.completed,
    });
  }, [puzzle.id, state.flipped, state.mistakes, state.elapsedMs, state.completed]);

  return { state, dispatch };
}
