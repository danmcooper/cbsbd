import type { Puzzle } from '../../../shared/puzzle';
import { validatePuzzle } from '../../../shared/puzzle';
import Grid from '../components/Grid';
import type { Guess } from '../game/reducer';
import { useGameState } from '../game/useGameState';
import { useFetch } from '../useFetch';

const REJECTION_COPY = "That doesn't fit yet.";

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function Board({ puzzle }: { puzzle: Puzzle }) {
  const { state, dispatch } = useGameState(puzzle);

  return (
    <main className="game">
      <header>
        <a href="#/">← Archive</a>
        <h1>{puzzle.title}</h1>
        <p className="meta">
          {puzzle.date} · {puzzle.difficulty} · mistakes: {state.mistakes}
        </p>
      </header>
      <Grid
        puzzle={puzzle}
        state={state}
        onGuess={(index, guess: Guess) => {
          dispatch({ type: 'guess', index, guess, now: Date.now() });
        }}
      />
      {state.rejectedIndex !== null && <p className="rejection">{REJECTION_COPY}</p>}
      {state.completed && (
        <p className="completed">
          Solved! {state.mistakes} mistakes · {formatTime(state.elapsedMs)}
        </p>
      )}
    </main>
  );
}

export default function Game({ date }: { date: string }) {
  const { data, error, retry } = useFetch<unknown>(`puzzles/${date}.json`);
  if (error) {
    return (
      <main>
        <p>Failed to load puzzle: {error}</p>
        <button onClick={retry}>Retry</button>
      </main>
    );
  }
  if (!data) return <p>Loading {date}</p>;
  let puzzle: Puzzle;
  try {
    puzzle = validatePuzzle(data);
  } catch (e) {
    return (
      <main>
        <p>Bad puzzle data: {String(e)}</p>
      </main>
    );
  }
  return <Board puzzle={puzzle} />;
}
