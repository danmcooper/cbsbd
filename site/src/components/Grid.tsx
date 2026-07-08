import type { Puzzle } from '../../../shared/puzzle';
import ClueText, { gridLabel } from '../clue/ClueText';
import type { GameState } from '../game/reducer';
import Card from './Card';

interface GridProps {
  puzzle: Puzzle;
  state: GameState;
  onOpen: (index: number) => void;
  onCycleTag: (index: number) => void;
}

export default function Grid({ puzzle, state, onOpen, onCycleTag }: GridProps) {
  return (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${puzzle.width}, auto)` }}>
      {puzzle.people.map((person, i) => (
        <Card
          key={i}
          person={person}
          label={gridLabel(i, puzzle.width)}
          flipped={state.flipped.includes(i)}
          rejected={state.rejectedIndex === i}
          tag={state.tags[i]}
          clueNode={
            person.clue ? (
              <ClueText clue={person.clue} people={puzzle.people} width={puzzle.width} selfIndex={i} />
            ) : undefined
          }
          onOpen={() => onOpen(i)}
          onCycleTag={() => onCycleTag(i)}
        />
      ))}
    </div>
  );
}
