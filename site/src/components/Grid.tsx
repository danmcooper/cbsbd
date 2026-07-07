import type { Puzzle } from '../../../shared/puzzle';
import type { GameState, Guess } from '../game/reducer';
import Card from './Card';

interface GridProps {
  puzzle: Puzzle;
  state: GameState;
  selectedIndex: number | null;
  onGuess: (index: number, guess: Guess) => void;
  onSelect: (index: number) => void;
}

export default function Grid({ puzzle, state, selectedIndex, onGuess, onSelect }: GridProps) {
  return (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${puzzle.width}, 1fr)` }}>
      {puzzle.people.map((person, i) => (
        <Card
          key={i}
          person={person}
          flipped={state.flipped.includes(i)}
          rejected={state.rejectedIndex === i}
          selected={selectedIndex === i}
          onGuess={(guess) => onGuess(i, guess)}
          onSelect={() => onSelect(i)}
        />
      ))}
    </div>
  );
}
