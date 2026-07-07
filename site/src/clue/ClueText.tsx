import type { ReactNode } from 'react';
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

function nameNode(props: ClueTextProps, index: number, key: string): ReactNode {
  if (index === props.selfIndex) return 'me';
  return (
    <span key={key} className="clue-name">
      {capitalize(props.people[index].name)}
    </span>
  );
}

// Positional paraphrase of an inclusive card range, ported from the live
// bundle: describe the segment by row/column or by the cards just outside it.
function betweenNodes(seg: { a: number; b: number }, props: ClueTextProps, key: string): ReactNode[] | null {
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
  const ref = (i: number) => nameNode(props, i, key);
  if (sameRow) {
    if (loCol === 0 && hiCol === width - 1) return [`in row ${loRow + 1}`];
    if (loCol === 0) return ['to the left of ', ref(after)];
    if (hiCol === width - 1) return ['to the right of ', ref(before)];
  } else {
    if (loRow === 0 && hiRow === height - 1) return [`in column ${columnLetter(loCol)}`];
    if (loRow === 0) return ['above ', ref(after)];
    if (hiRow === height - 1) return ['below ', ref(before)];
  }
  if (props.selfIndex === before) return ['in between ', ref(after), ' and me'];
  if (props.selfIndex === after) return ['in between ', ref(before), ' and me'];
  return ['in between ', ref(before), ' and ', ref(after)];
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

function segmentNodes(seg: ClueSegment, props: ClueTextProps, key: string): ReactNode[] {
  switch (seg.kind) {
    case 'name': {
      const p = props.people[seg.index];
      if (!p) return [rawToken(seg)];
      const name = capitalize(p.name);
      const text = seg.possessive ? (name.endsWith('s') ? `${name}'` : `${name}'s`) : name;
      return [
        <span key={key} className="clue-name">
          {text}
        </span>,
      ];
    }
    case 'prof': {
      const word = seg.plural ? (seg.word === 'witch' ? 'witches' : `${seg.word}s`) : seg.word;
      return [
        <span key={key} className="clue-prof">
          {word}
        </span>,
      ];
    }
    case 'column':
      // Source text already carries the word "column" ("… in column #C:1").
      return [columnLetter(seg.column)];
    case 'between':
      return betweenNodes(seg, props, key) ?? [rawToken(seg)];
    case 'text':
      return [seg.text];
  }
}

export default function ClueText(props: ClueTextProps) {
  const segments = tokenizeClue(prepass(props.clue, props.selfIndex));
  const nodes = segments.flatMap((seg, i) => segmentNodes(seg, props, `s${i}`));
  // The real renderer capitalizes the first letter of the finished clue.
  if (typeof nodes[0] === 'string') nodes[0] = capitalize(nodes[0]);
  return <span className="clue-text">{nodes}</span>;
}
