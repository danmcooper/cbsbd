import type { Puzzle } from '../../../shared/puzzle';
import ClueText, { gridLabel } from '../clue/ClueText';
import type { GameState, Guess } from '../game/reducer';
import Card from './Card';

interface GridProps {
  puzzle: Puzzle;
  state: GameState;
  onGuess: (index: number, guess: Guess) => void;
}

export default function Grid({ puzzle, state, onGuess }: GridProps) {
  return (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${puzzle.width}, 1fr)` }}>
      {puzzle.people.map((person, i) => (
        <Card
          key={i}
          person={person}
          label={gridLabel(i, puzzle.width)}
          flipped={state.flipped.includes(i)}
          rejected={state.rejectedIndex === i}
          clueNode={
            person.clue ? (
              <ClueText clue={person.clue} people={puzzle.people} width={puzzle.width} selfIndex={i} />
            ) : undefined
          }
          onGuess={(guess) => onGuess(i, guess)}
        />
      ))}
    </div>
  );
}
