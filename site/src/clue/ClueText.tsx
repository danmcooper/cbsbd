import type { Person } from '../../../shared/puzzle';
import { tokenizeClue, type ClueSegment } from './tokenize';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const columnLetter = (n: number) => String.fromCharCode(65 + n);

function segmentText(seg: ClueSegment, people: Person[]): string | null {
  switch (seg.kind) {
    case 'name': {
      const p = people[seg.index];
      if (!p) return null;
      return capitalize(p.name) + (seg.possessive ? "'s" : '');
    }
    case 'prof':
      return seg.word + (seg.plural ? 's' : '');
    case 'column':
      return `column ${columnLetter(seg.column)}`;
    case 'between': {
      const a = people[seg.a];
      const b = people[seg.b];
      if (!a || !b) return null;
      return `between ${capitalize(a.name)} and ${capitalize(b.name)}`;
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

export default function ClueText({ clue, people }: { clue: string; people: Person[] }) {
  return (
    <span className="clue-text">
      {tokenizeClue(clue).map((seg, i) => {
        const text = segmentText(seg, people);
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
