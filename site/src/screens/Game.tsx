import { useState } from 'react';
import type { Puzzle } from '../../../shared/puzzle';
import { validatePuzzle } from '../../../shared/puzzle';
import Grid from '../components/Grid';
import { faceFor } from '../faces';
import type { Guess } from '../game/reducer';
import { useGameState } from '../game/useGameState';
import { useFetch } from '../useFetch';

const REJECTION_COPY = "That doesn't fit yet.";

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function GuessModal({
  puzzle,
  index,
  onGuess,
  onClose,
}: {
  puzzle: Puzzle;
  index: number;
  onGuess: (guess: Guess) => void;
  onClose: () => void;
}) {
  const person = puzzle.people[index];
  return (
    <div className="overlay" onClick={onClose}>
      <div role="dialog" aria-label={person.name} className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-face">{faceFor(person.profession, person.gender)}</div>
        <div className="modal-name">{person.name}</div>
        <div className="modal-prof">{person.profession}</div>
        <div className="modal-choices">
          <button className="btn-innocent" onClick={() => onGuess('innocent')}>
            Innocent
          </button>
          <button className="btn-criminal" onClick={() => onGuess('criminal')}>
            Criminal
          </button>
        </div>
        <button className="btn-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function Board({ puzzle }: { puzzle: Puzzle }) {
  const { state, dispatch } = useGameState(puzzle);
  const [guessing, setGuessing] = useState<number | null>(null);

  return (
    <main className="game">
      <header>
        <a href="#/">← Archive</a>
        <h1>{puzzle.title}</h1>
        <p className="meta">
          {puzzle.date} · {puzzle.difficulty} · mistakes: {state.mistakes}
        </p>
      </header>
      <Grid puzzle={puzzle} state={state} onOpen={setGuessing} />
      {state.rejectedIndex !== null && <p className="rejection">{REJECTION_COPY}</p>}
      {state.completed && (
        <p className="completed">
          Solved! {state.mistakes} mistakes · {formatTime(state.elapsedMs)}
        </p>
      )}
      {guessing !== null && (
        <GuessModal
          puzzle={puzzle}
          index={guessing}
          onGuess={(guess) => {
            dispatch({ type: 'guess', index: guessing, guess, now: Date.now() });
            setGuessing(null);
          }}
          onClose={() => setGuessing(null)}
        />
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
