import type { ReactNode } from "react";
import type { Person } from "../../../shared/puzzle";
import { faceFor } from "../faces";
import type { Tag } from "../game/reducer";

interface CardProps {
  person: Person;
  label: string;
  flipped: boolean;
  rejected: boolean;
  tag?: Tag;
  /** The player marked this card's clue as used. */
  consumed: boolean;
  /** Just flipped from a correct guess; shows the Correct! bubble. */
  justFlipped: boolean;
  /** An active (unconsumed) clue mentions this card's name / profession. */
  nameReferenced: boolean;
  profReferenced: boolean;
  /** Rendered clue shown on the card once it is flipped. */
  clueNode?: ReactNode;
  /** Opens the guess modal for this card. */
  onOpen: () => void;
  /** Cycles the corner tag: none -> yellow -> red -> green -> none. */
  onCycleTag: () => void;
  /** Toggles this card's clue between active and consumed. */
  onToggleClue: () => void;
}

export default function Card({
  person,
  label,
  flipped,
  rejected,
  tag,
  consumed,
  justFlipped,
  nameReferenced,
  profReferenced,
  clueNode,
  onOpen,
  onCycleTag,
  onToggleClue,
}: CardProps) {
  const classes = [
    "card",
    flipped ? "flipped" : "",
    flipped ? (person.criminal ? "criminal" : "innocent") : "",
    rejected ? "rejected" : "",
    consumed ? "consumed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div role="group" className={classes} onClick={flipped ? undefined : onOpen}>
      <div
        className={tag ? `tag tag-${tag}` : "tag"}
        onClick={(e) => {
          e.stopPropagation();
          onCycleTag();
        }}
      />
      <div className="card-pos">{label}</div>
      {justFlipped && <div className="speech-bubble">Correct!</div>}
      <div className="card-face">{faceFor(person.profession, person.gender)}</div>
      <div className={nameReferenced ? "card-name referenced" : "card-name"}>{person.name}</div>
      <div className={profReferenced ? "card-prof referenced" : "card-prof"}>
        {person.profession}
      </div>
      {flipped && clueNode && (
        <div className="card-clue" onClick={onToggleClue}>
          {clueNode}
        </div>
      )}
    </div>
  );
}
