export type ClueSegment =
  | { kind: 'text'; text: string }
  | { kind: 'name'; index: number; possessive: boolean }
  | { kind: 'prof'; word: string; plural: boolean }
  | { kind: 'column'; column: number }
  | { kind: 'between'; a: number; b: number };

const TOKEN = /#([A-Z]+)(?::(pair\(\d+,\d+\)|\w+))?/g;

function parseToken(tag: string, arg: string | undefined): ClueSegment | null {
  switch (tag) {
    case 'NAME':
    case 'NAMES': {
      if (arg === undefined || !/^\d+$/.test(arg)) return null;
      return { kind: 'name', index: Number(arg), possessive: tag === 'NAMES' };
    }
    case 'PROF':
    case 'PROFS': {
      if (arg === undefined || /^\d/.test(arg)) return null;
      return { kind: 'prof', word: arg, plural: tag === 'PROFS' };
    }
    case 'C': {
      if (arg === undefined || !/^\d+$/.test(arg)) return null;
      return { kind: 'column', column: Number(arg) };
    }
    case 'BETWEEN': {
      const m = arg?.match(/^pair\((\d+),(\d+)\)$/);
      if (!m) return null;
      return { kind: 'between', a: Number(m[1]), b: Number(m[2]) };
    }
    default:
      return null;
  }
}

export function tokenizeClue(clue: string): ClueSegment[] {
  const segments: ClueSegment[] = [];
  let last = 0;
  for (const m of clue.matchAll(TOKEN)) {
    if (m.index > last) segments.push({ kind: 'text', text: clue.slice(last, m.index) });
    const parsed = parseToken(m[1], m[2]);
    segments.push(parsed ?? { kind: 'text', text: m[0] }); // unknown token: raw text fallback
    last = m.index + m[0].length;
  }
  if (last < clue.length) segments.push({ kind: 'text', text: clue.slice(last) });
  return segments;
}
