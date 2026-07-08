import type { Puzzle } from "../../../shared/puzzle";
import ClueText, { clueReferencedIndices, gridLabel } from "../clue/ClueText";
import type { GameState, Tag } from "../game/reducer";
import Card from "./Card";

interface GridProps {
  puzzle: Puzzle;
  state: GameState;
  /** Card that just flipped from a correct guess (shows the Correct! bubble). */
  justFlipped: number | null;
  /** Card whose long-press color picker is open. */
  pickerIndex: number | null;
  onOpen: (index: number) => void;
  onCycleTag: (index: number) => void;
  onOpenPicker: (index: number) => void;
  onPickTag: (index: number, tag: Tag | null) => void;
  onToggleClue: (index: number) => void;
}

export default function Grid({
  puzzle,
  state,
  justFlipped,
  pickerIndex,
  onOpen,
  onCycleTag,
  onOpenPicker,
  onPickTag,
  onToggleClue,
}: GridProps) {
  // Every active (flipped, unconsumed) clue emphasizes its own card's name
  // plus the names/professions it mentions.
  const nameRefs = new Set<number>();
  const profRefs = new Set<number>();
  puzzle.people.forEach((person, i) => {
    if (!person.clue || !state.flipped.includes(i) || state.consumed.includes(i)) return;
    nameRefs.add(i);
    const refs = clueReferencedIndices(person.clue, puzzle.people, puzzle.width, i);
    refs.names.forEach((n) => nameRefs.add(n));
    refs.profs.forEach((n) => profRefs.add(n));
  });

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
          consumed={state.consumed.includes(i)}
          justFlipped={justFlipped === i}
          pickerOpen={pickerIndex === i}
          nameReferenced={nameRefs.has(i)}
          profReferenced={profRefs.has(i)}
          clueNode={
            person.clue ? (
              <ClueText
                clue={person.clue}
                people={puzzle.people}
                width={puzzle.width}
                selfIndex={i}
              />
            ) : undefined
          }
          onOpen={() => onOpen(i)}
          onCycleTag={() => onCycleTag(i)}
          onOpenPicker={() => onOpenPicker(i)}
          onPickTag={(tag) => onPickTag(i, tag)}
          onToggleClue={() => onToggleClue(i)}
        />
      ))}
    </div>
  );
}
