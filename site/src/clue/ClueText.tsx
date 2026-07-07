import type { Person } from '../../../shared/puzzle';
import { tokenizeClue, type ClueSegment } from './tokenize';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const columnLetter = (n: number) => String.fromCharCode(65 + n);

// "A1", "D5", … matching the corner labels on the cards.
export const gridLabel = (index: number, width: number) =>
  `${columnLetter(index % width)}${Math.floor(index / width) + 1}`;

interface ClueTextProps {
  clue: string;
  people: Person[];
  width: number;
  /** Index of the card this clue belongs to; its own references render as me/my. */
  selfIndex?: number;
}

function segmentText(seg: ClueSegment, { people, width, selfIndex }: ClueTextProps): string | null {
  switch (seg.kind) {
    case 'name': {
      if (seg.index === selfIndex) return seg.possessive ? 'my' : 'me';
      const p = people[seg.index];
      if (!p) return null;
      return capitalize(p.name) + (seg.possessive ? "'s" : '');
    }
    case 'prof':
      return seg.word + (seg.plural ? 's' : '');
    case 'column':
      // Source text already carries the word "column" ("… in column #C:1").
      return columnLetter(seg.column);
    case 'between': {
      // Inclusive range of cards between two grid positions (endpoints count).
      if (seg.a >= people.length || seg.b >= people.length) return null;
      return `in ${gridLabel(seg.a, width)}–${gridLabel(seg.b, width)}`;
    }
    case 'text':
      return seg.text;
  }
}

function rawToken(seg: ClueSegment): string {
  // Reconstruct the original token for out-of-range references.
  switch (seg.kind) {
    case 'name':
      return `#${seg.possessive ? 'NAMES' : 'NAME'}:${seg.index}`;
    case 'between':
      return `#BETWEEN:pair(${seg.a},${seg.b})`;
    default:
      return '';
  }
}

export default function ClueText(props: ClueTextProps) {
  return (
    <span className="clue-text">
      {tokenizeClue(props.clue).map((seg, i) => {
        const text = segmentText(seg, props);
        if (text === null) return <span key={i}>{rawToken(seg)}</span>;
        if (seg.kind === 'name' || seg.kind === 'between') {
          return (
            <span key={i} className="clue-name">
              {text}
            </span>
          );
        }
        if (seg.kind === 'prof') {
          return (
            <span key={i} className="clue-prof">
              {text}
            </span>
          );
        }
        return <span key={i}>{text}</span>;
      })}
    </span>
  );
}
