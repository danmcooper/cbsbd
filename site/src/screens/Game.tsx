import { useEffect, useRef, useState } from "react";
import type { Puzzle } from "../../../shared/puzzle";
import { validatePuzzle } from "../../../shared/puzzle";
import Grid from "../components/Grid";
import { faceFor } from "../faces";
import type { GameState, Guess } from "../game/reducer";
import { useGameState } from "../game/useGameState";
import { useFetch } from "../useFetch";

const REJECTION_COPY = "That doesn't fit yet.";

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// "2026-07-07" -> "Jul 7th 2026"
function formatDateOrdinal(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  const day = d.getDate();
  const suffix =
    day % 100 >= 11 && day % 100 <= 13
      ? "th"
      : (["th", "st", "nd", "rd"][day % 10] ?? "th");
  return `${d.toLocaleString("en-US", { month: "short" })} ${day}${suffix} ${d.getFullYear()}`;
}

// Results grid: green = clean solve, yellow = had a bad answer.
// (Orange = used a clue on the real site; we have no hint feature yet.)
type CellColor = "green" | "yellow" | "orange";

function cellColors(puzzle: Puzzle, state: GameState): CellColor[] {
  return puzzle.people.map((_, i) =>
    state.wrong.includes(i) ? "yellow" : "green",
  );
}

const CELL_EMOJI: Record<CellColor, string> = {
  green: "🟩",
  yellow: "🟨",
  orange: "🟠",
};

function ResultsModal({
  puzzle,
  state,
  onClose,
}: {
  puzzle: Puzzle;
  state: GameState;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const title = `${formatDateOrdinal(puzzle.date)} (${puzzle.difficulty})`;
  const solvedIn = `Solved in ${formatTime(state.elapsedMs)}`;
  const colors = cellColors(puzzle, state);
  const rows = [...Array(puzzle.height)].map((_, r) =>
    colors.slice(r * puzzle.width, (r + 1) * puzzle.width),
  );

  const copyText = async () => {
    const grid = rows
      .map((row) => row.map((c) => CELL_EMOJI[c]).join(""))
      .join("\n");
    await navigator.clipboard.writeText(
      `I solved the daily #CluesBySam, ${title}, in ${formatTime(state.elapsedMs)}\n${grid}\nhttps://cluesbysam.com`,
    );
    setCopied(true);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div
        role="dialog"
        aria-label="results"
        className="modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="results-title">{title}</h2>
        <div className="share-grid">
          {rows.map((row, r) => (
            <div key={r} className="share-row">
              {row.map((color, c) => (
                <span key={c} className={`share-cell share-${color}`} />
              ))}
            </div>
          ))}
        </div>
        <p className="solved-in">{solvedIn}</p>
        <button className="btn-copy" onClick={copyText}>
          {copied ? "Copied!" : "Copy Text"}
        </button>
        <button className="btn-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
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
      <div
        role="dialog"
        aria-label={person.name}
        className="modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-face">
          {faceFor(person.profession, person.gender)}
        </div>
        <div className="modal-name">{person.name}</div>
        <div className="modal-prof">{person.profession}</div>
        <div className="modal-choices">
          <button className="btn-innocent" onClick={() => onGuess("innocent")}>
            Innocent
          </button>
          <button className="btn-criminal" onClick={() => onGuess("criminal")}>
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
  const [resultsOpen, setResultsOpen] = useState(false);
  // A puzzle is "new" when localStorage holds no guesses and no elapsed time.
  const [startOpen, setStartOpen] = useState(
    () =>
      !state.completed &&
      state.mistakes === 0 &&
      state.elapsedMs === 0 &&
      state.flipped.length === puzzle.initialReveals.length,
  );
  const completedAtMount = useRef(state.completed);

  useEffect(() => {
    if (state.completed && !completedAtMount.current) setResultsOpen(true);
  }, [state.completed]);

  // A started puzzle resumes its clock immediately after a page refresh.
  useEffect(() => {
    const begun =
      state.elapsedMs > 0 ||
      state.mistakes > 0 ||
      state.flipped.length > puzzle.initialReveals.length;
    if (begun && !state.completed) dispatch({ type: "start", now: Date.now() });
    // Mount-time resume only.
  }, []);

  // Once started (and not paused/completed), the clock ticks every second the
  // page is shown; each tick folds elapsed time into state, which persists it.
  useEffect(() => {
    if (state.completed) return;
    const id = setInterval(() => dispatch({ type: "tick", now: Date.now() }), 1000);
    return () => clearInterval(id);
  }, [state.completed, dispatch]);
  const elapsed = state.elapsedMs;
  const minutes = Math.floor(elapsed / 60_000);
  const [showSeconds, setShowSeconds] = useState(
    () => localStorage.getItem("cbs:pref:showSeconds") === "1",
  );
  const toggleSeconds = () => {
    const next = !showSeconds;
    localStorage.setItem("cbs:pref:showSeconds", next ? "1" : "0");
    setShowSeconds(next);
  };
  const [paused, setPaused] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const togglePause = () => {
    if (paused) {
      dispatch({ type: "start", now: Date.now() });
      setPaused(false);
    } else {
      dispatch({ type: "pause", now: Date.now() });
      setPaused(true);
    }
  };

  const confirmReset = () => {
    dispatch({ type: "reset" });
    setResetOpen(false);
    setPaused(false);
    setStartOpen(true);
  };

  return (
    <main className="game">
      <div className="board-wrap">
        <Grid
          puzzle={puzzle}
          state={state}
          onOpen={setGuessing}
          onCycleTag={(index) => dispatch({ type: "cycleTag", index })}
          onToggleClue={(index) => dispatch({ type: "toggleConsumed", index })}
        />
        <div className="controls">
          <div className="button-row">
            <button onClick={togglePause}>{paused ? 'Unpause' : 'Pause'}</button>
            <button onClick={() => setResetOpen(true)}>Reset</button>
            <button>💡Show hint</button>
          </div>
          <p className="date-line">
            <span>
              {formatDateOrdinal(puzzle.date)} ({puzzle.difficulty})
            </span>
            <span className="timer" onClick={toggleSeconds}>
              {showSeconds ? formatTime(elapsed) : `${minutes} Minute${minutes === 1 ? '' : 's'}`}
            </span>
          </p>
        </div>
        {state.rejectedIndex !== null && (
          <p className="rejection">{REJECTION_COPY}</p>
        )}
        {state.completed && (
          <p className="completed">
            Solved! {state.mistakes} mistakes · {formatTime(state.elapsedMs)}{" "}
            <button
              className="btn-results"
              onClick={() => setResultsOpen(true)}
            >
              Results
            </button>
          </p>
        )}
        <p className="archive-link">
          <a href="#/">← Archive</a>
        </p>
      </div>
      {paused && <div className="pause-overlay" />}
      {resetOpen && (
        <div className="overlay" onClick={() => setResetOpen(false)}>
          <div
            role="dialog"
            aria-label="reset"
            className="modal reset-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="reset-question">Reset this puzzle?</p>
            <div className="modal-choices">
              <button className="btn-criminal" onClick={confirmReset}>
                Reset
              </button>
              <button className="btn-close" onClick={() => setResetOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {resultsOpen && (
        <ResultsModal
          puzzle={puzzle}
          state={state}
          onClose={() => setResultsOpen(false)}
        />
      )}
      {startOpen && (
        <div className="overlay">
          <div role="dialog" aria-label="start" className="modal start-modal">
            <h2 className="start-title">Welcome to Clues by Sam!</h2>
            <p className="start-date">{formatDateOrdinal(puzzle.date)}</p>
            <p className="start-difficulty">
              Difficulty: <b>{puzzle.difficulty}</b>
            </p>
            <button
              className="btn-start"
              onClick={() => {
                dispatch({ type: "start", now: Date.now() });
                setStartOpen(false);
              }}
            >
              Start
            </button>
          </div>
        </div>
      )}
      {guessing !== null && (
        <GuessModal
          puzzle={puzzle}
          index={guessing}
          onGuess={(guess) => {
            dispatch({
              type: "guess",
              index: guessing,
              guess,
              now: Date.now(),
            });
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
