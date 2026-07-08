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
  /** Index of the card this clue belongs to; its own references render as I/me/my. */
  selfIndex?: number;
}

// String-level rewrites the real renderer applies before token expansion:
// self-references get first-person grammar, "exactly 0" reads as "no".
function prepass(clue: string, self: number | undefined): string {
  let s = clue.replace(' exactly 0 ', ' no ');
  if (self === undefined) return s;
  s = s.replace(new RegExp(`#NAMES:${self}\\b`, 'g'), 'my');
  s = s.replace(/#NAME:(\d+) and #NAME:(\d+)\b/g, (m, x: string, y: string) => {
    if (Number(x) === self) return `#NAME:${y} and I`;
    if (Number(y) === self) return `#NAME:${x} and I`;
    return m;
  });
  s = s.replace(new RegExp(`^#NAME:${self} (is|has)\\b`), (_m, verb: string) =>
    verb === 'is' ? 'I am' : 'I have',
  );
  s = s.replace(new RegExp(`^#NAME:${self}\\b`), 'I');
  s = s.replace(new RegExp(`#NAME:${self}\\b`, 'g'), 'me');
  return s;
}

function nameRef(props: ClueTextProps, index: number): string {
  if (index === props.selfIndex) return 'me';
  return capitalize(props.people[index].name);
}

// Positional paraphrase of an inclusive card range, ported from the live
// bundle: describe the segment by row/column or by the cards just outside it.
function betweenText(seg: { a: number; b: number }, props: ClueTextProps): string | null {
  const { people, width } = props;
  const height = people.length / width;
  const lo = Math.min(seg.a, seg.b);
  const hi = Math.max(seg.a, seg.b);
  if (hi >= people.length) return null;
  const loCol = lo % width;
  const loRow = Math.floor(lo / width);
  const hiCol = hi % width;
  const hiRow = Math.floor(hi / width);
  const sameRow = loRow === hiRow;
  const before = lo - (sameRow ? 1 : width);
  const after = hi + (sameRow ? 1 : width);
  if (sameRow) {
    if (loCol === 0 && hiCol === width - 1) return `in row ${loRow + 1}`;
    if (loCol === 0) return `to the left of ${nameRef(props, after)}`;
    if (hiCol === width - 1) return `to the right of ${nameRef(props, before)}`;
  } else {
    if (loRow === 0 && hiRow === height - 1) return `in column ${columnLetter(loCol)}`;
    if (loRow === 0) return `above ${nameRef(props, after)}`;
    if (hiRow === height - 1) return `below ${nameRef(props, before)}`;
  }
  if (props.selfIndex === before) return `in between ${nameRef(props, after)} and me`;
  if (props.selfIndex === after) return `in between ${nameRef(props, before)} and me`;
  return `in between ${nameRef(props, before)} and ${nameRef(props, after)}`;
}

function rawToken(seg: ClueSegment): string {
  // Reconstruct the original token for out-of-range references.
  switch (seg.kind) {
    case 'name':
      return `#${seg.possessive ? 'NAMES' : 'NAME'}:${seg.index}`;
    case 'between':
      return `#BETWEEN:pair(${seg.a},${seg.b})`;
    case 'column':
      return `#C:${seg.column}`;
    default:
      return '';
  }
}

function segmentText(seg: ClueSegment, props: ClueTextProps): string {
  switch (seg.kind) {
    case 'name': {
      const p = props.people[seg.index];
      if (!p) return rawToken(seg);
      const name = capitalize(p.name);
      return seg.possessive ? (name.endsWith('s') ? `${name}'` : `${name}'s`) : name;
    }
    case 'prof':
      return seg.plural ? (seg.word === 'witch' ? 'witches' : `${seg.word}s`) : seg.word;
    case 'column':
      // #C:n is 1-based ("column #C:1" is column A); the word "column" is in the source text.
      return seg.column >= 1 ? columnLetter(seg.column - 1) : rawToken(seg);
    case 'between':
      return betweenText(seg, props) ?? rawToken(seg);
    case 'text':
      return seg.text;
  }
}

export default function ClueText(props: ClueTextProps) {
  const segments = tokenizeClue(prepass(props.clue, props.selfIndex));
  // The real renderer capitalizes the first letter of the finished clue.
  const text = capitalize(segments.map((seg) => segmentText(seg, props)).join(''));
  return <span className="clue-text">{text}</span>;
}
