import type { ReactNode } from 'react';
import type { Person } from '../../../shared/puzzle';
import { faceFor } from '../faces';

interface CardProps {
  person: Person;
  label: string;
  flipped: boolean;
  rejected: boolean;
  /** Rendered clue shown on the card once it is flipped. */
  clueNode?: ReactNode;
  /** Opens the guess modal for this card. */
  onOpen: () => void;
}

export default function Card({ person, label, flipped, rejected, clueNode, onOpen }: CardProps) {
  const classes = [
    'card',
    flipped ? 'flipped' : '',
    flipped ? (person.criminal ? 'criminal' : 'innocent') : '',
    rejected ? 'rejected' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div role="group" className={classes} onClick={flipped ? undefined : onOpen}>
      <div className="card-pos">{label}</div>
      <div className="card-face">{faceFor(person.profession, person.gender)}</div>
      <div className="card-name">{person.name}</div>
      <div className="card-prof">{person.profession}</div>
      {flipped && clueNode && <div className="card-clue">{clueNode}</div>}
    </div>
  );
}
