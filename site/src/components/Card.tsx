import { useState, type ReactNode } from 'react';
import type { Person } from '../../../shared/puzzle';
import { faceFor } from '../faces';
import type { Guess } from '../game/reducer';

interface CardProps {
  person: Person;
  label: string;
  flipped: boolean;
  rejected: boolean;
  /** Rendered clue shown on the card once it is flipped. */
  clueNode?: ReactNode;
  onGuess: (guess: Guess) => void;
}

export default function Card({ person, label, flipped, rejected, clueNode, onGuess }: CardProps) {
  const [choosing, setChoosing] = useState(false);

  const classes = [
    'card',
    flipped ? 'flipped' : '',
    flipped ? (person.criminal ? 'criminal' : 'innocent') : '',
    rejected ? 'rejected' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (flipped) {
    return (
      <div role="group" className={classes}>
        <div className="card-pos">{label}</div>
        <div className="card-face">{faceFor(person.profession, person.gender)}</div>
        <div className="card-name">{person.name}</div>
        <div className="card-prof">{person.profession}</div>
        {clueNode && <div className="card-clue">{clueNode}</div>}
      </div>
    );
  }

  return (
    <div role="group" className={classes} onClick={() => setChoosing(true)}>
      <div className="card-pos">{label}</div>
      <div className="card-face">{faceFor(person.profession, person.gender)}</div>
      <div className="card-name">{person.name}</div>
      <div className="card-prof">{person.profession}</div>
      {choosing && (
        <div className="card-choice">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setChoosing(false);
              onGuess('criminal');
            }}
          >
            Criminal
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setChoosing(false);
              onGuess('innocent');
            }}
          >
            Innocent
          </button>
        </div>
      )}
    </div>
  );
}
