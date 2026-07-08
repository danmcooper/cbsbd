export interface Person {
  name: string;
  profession: string;
  gender: string;
  criminal: boolean;
  clue: string | null;
  origHint: string | null;
  paths: number[][] | null;
  /** Emoji from the source bundle's face map; absent in older puzzle files. */
  face?: string | null;
}

export interface Puzzle {
  formatVersion: 1;
  id: string;
  date: string;
  title: string;
  difficulty: string;
  width: number;
  height: number;
  initialReveals: number[];
  source: string;
  people: Person[];
}

export class PuzzleValidationError extends Error {}

function fail(msg: string): never {
  throw new PuzzleValidationError(msg);
}

export function validatePuzzle(data: unknown): Puzzle {
  if (typeof data !== 'object' || data === null) fail('puzzle is not an object');
  const p = data as Record<string, unknown>;
  if (p.formatVersion !== 1) fail(`unsupported formatVersion: ${String(p.formatVersion)}`);
  if (typeof p.id !== 'string' || !/^[0-9a-f]{12}$/.test(p.id)) fail('id must be 12 lowercase hex chars');
  if (typeof p.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.date)) fail('date must be YYYY-MM-DD');
  if (typeof p.title !== 'string') fail('title must be a string');
  if (typeof p.difficulty !== 'string') fail('difficulty must be a string');
  if (typeof p.source !== 'string') fail('source must be a string');
  if (!Number.isInteger(p.width) || (p.width as number) < 1) fail('width must be a positive integer');
  if (!Number.isInteger(p.height) || (p.height as number) < 1) fail('height must be a positive integer');
  const count = (p.width as number) * (p.height as number);
  if (!Array.isArray(p.people)) fail('people must be an array');
  if (p.people.length !== count) fail(`people length ${p.people.length} != width*height ${count}`);
  const inRange = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) < count;
  if (!Array.isArray(p.initialReveals) || !p.initialReveals.every(inRange)) {
    fail('initialReveals must be an array of in-range card indices');
  }
  p.people.forEach((raw, i) => {
    const where = `people[${i}]`;
    if (typeof raw !== 'object' || raw === null) fail(`${where} is not an object`);
    const q = raw as Record<string, unknown>;
    if (typeof q.name !== 'string' || q.name === '') fail(`${where}.name must be a non-empty string`);
    if (typeof q.profession !== 'string' || q.profession === '') fail(`${where}.profession must be a non-empty string`);
    if (typeof q.gender !== 'string') fail(`${where}.gender must be a string`);
    if (typeof q.criminal !== 'boolean') fail(`${where}.criminal must be a boolean`);
    if (q.clue !== null && typeof q.clue !== 'string') fail(`${where}.clue must be a string or null`);
    if (q.origHint !== null && typeof q.origHint !== 'string') fail(`${where}.origHint must be a string or null`);
    if (q.face !== undefined && q.face !== null && typeof q.face !== 'string') {
      fail(`${where}.face must be a string, null, or absent`);
    }
    if (q.paths !== null) {
      const ok =
        Array.isArray(q.paths) &&
        q.paths.every((path) => Array.isArray(path) && path.every(inRange));
      if (!ok) fail(`${where}.paths must be null or an array of arrays of in-range indices`);
    }
  });
  return data as Puzzle;
}
