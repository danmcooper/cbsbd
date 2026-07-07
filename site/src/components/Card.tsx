import { useState } from 'react';
import type { Person } from '../../../shared/puzzle';
import { faceFor } from '../faces';
import type { Guess } from '../game/reducer';

interface CardProps {
  person: Person;
  flipped: boolean;
  rejected: boolean;
  selected: boolean;
  onGuess: (guess: Guess) => void;
  onSelect: () => void;
}

export default function Card({ person, flipped, rejected, selected, onGuess, onSelect }: CardProps) {
  const [choosing, setChoosing] = useState(false);

  const classes = [
    'card',
    flipped ? 'flipped' : '',
    flipped ? (person.criminal ? 'criminal' : 'innocent') : '',
    rejected ? 'rejected' : '',
    selected ? 'selected' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (flipped) {
    return (
      <div role="group" className={classes} onClick={onSelect}>
        <div className="card-verdict">{person.criminal ? 'CRIMINAL' : 'INNOCENT'}</div>
        <div className="card-face">{faceFor(person.profession, person.gender)}</div>
        <div className="card-name">{person.name}</div>
        <div className="card-prof">{person.profession}</div>
      </div>
    );
  }

  return (
    <div role="group" className={classes} onClick={() => setChoosing(true)}>
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
