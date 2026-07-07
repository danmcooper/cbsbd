import vm from 'node:vm';
import { PuzzleValidationError, validatePuzzle, type Puzzle } from '../../shared/puzzle.ts';

export type ExtractStage =
  | 'page-fetch'
  | 'bundle-discovery'
  | 'bundle-fetch'
  | 'array-parse'
  | 'metadata-parse'
  | 'validation'
  | 'conflict';

export class ExtractError extends Error {
  constructor(
    public stage: ExtractStage,
    message: string,
  ) {
    super(`[${stage}] ${message}`);
    this.name = 'ExtractError';
  }
}

export function findBundleUrl(html: string, pageUrl: string): string {
  const tags = html.match(/<script\b[^>]*>/g) ?? [];
  for (const tag of tags) {
    if (!/type="module"/.test(tag)) continue;
    const src = tag.match(/src="([^"]+)"/);
    if (src && /assets\/index-[^"/]*\.js$/.test(src[1])) {
      return new URL(src[1], pageUrl).href;
    }
  }
  throw new ExtractError('bundle-discovery', 'no module script matching assets/index-*.js in page HTML');
}

export function extractPeopleArray(bundle: string): unknown[] {
  const start = bundle.indexOf('[{criminal:');
  if (start === -1) throw new ExtractError('array-parse', 'signature "[{criminal:" not found in bundle');
  let depth = 0;
  let end = -1;
  let inString: string | null = null;
  for (let i = start; i < bundle.length; i++) {
    const c = bundle[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === inString) inString = null;
    } else if (c === '"' || c === "'" || c === '`') {
      inString = c;
    } else if (c === '[') {
      depth++;
    } else if (c === ']') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) throw new ExtractError('array-parse', 'unbalanced brackets after array signature');
  const src = bundle.slice(start, end + 1);
  let value: unknown;
  try {
    value = vm.runInNewContext(`(${src})`, Object.create(null), { timeout: 1000 });
  } catch (e) {
    throw new ExtractError('array-parse', `sandbox evaluation of array slice failed: ${String(e)}`);
  }
  if (!Array.isArray(value)) throw new ExtractError('array-parse', 'evaluated slice is not an array');
  return value;
}

export interface BundleMetadata {
  width: number;
  height: number;
  difficulty: string;
  title: string;
  date: string;
  id: string;
  initialReveals: number[];
}

function parseIntList(csv: string): number[] {
  return csv === '' ? [] : csv.split(',').map(Number);
}

export function extractMetadata(bundle: string): BundleMetadata {
  // e.g. nv=4,av=5,uv="Medium",iv="…title…",cv=[{criminal:
  const head = bundle.match(/[\w$]+=(\d+),[\w$]+=(\d+),[\w$]+="([^"]*)",[\w$]+="([^"]*)",[\w$]+=\[\{criminal:/);
  if (!head) {
    throw new ExtractError('metadata-parse', 'width/height/difficulty/title constants not found before people array');
  }
  const date = bundle.match(/"(\d{4}-\d{2}-\d{2})"/);
  if (!date) throw new ExtractError('metadata-parse', 'date constant "YYYY-MM-DD" not found');
  const id =
    bundle.match(/"([0-9a-f]{12})"[\s\S]{0,300}?"https:\/\/cluesbysam\.com\/log"/) ??
    bundle.match(/"https:\/\/cluesbysam\.com\/log"[\s\S]{0,300}?"([0-9a-f]{12})"/);
  if (!id) throw new ExtractError('metadata-parse', 'puzzleId (12-hex constant near /log URL) not found');

  let initialReveals: number[];
  const inline = bundle.match(/initial_reveals:\[([\d,]*)\]/);
  if (inline) {
    initialReveals = parseIntList(inline[1]);
  } else {
    const indirect = bundle.match(/initial_reveals:([\w$]+)/);
    if (!indirect) throw new ExtractError('metadata-parse', 'initial_reveals not found');
    const ident = indirect[1].replace(/\$/g, '\\$');
    const def = bundle.match(new RegExp(`[,;=\\s({]${ident}=\\[([\\d,]*)\\]`));
    if (!def) {
      throw new ExtractError('metadata-parse', `initial_reveals identifier ${indirect[1]} has no array definition`);
    }
    initialReveals = parseIntList(def[1]);
  }

  return {
    width: Number(head[1]),
    height: Number(head[2]),
    difficulty: head[3],
    title: head[4],
    date: date[1],
    id: id[1],
    initialReveals,
  };
}

export function normalizePuzzle(meta: BundleMetadata, rawPeople: unknown[]): Puzzle {
  const people = rawPeople.map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
      name: r.name,
      profession: r.profession,
      gender: r.gender,
      criminal: r.criminal === true,
      clue: typeof r.hint === 'string' && r.hint !== '' ? r.hint : null,
      origHint: typeof r.orig_hint === 'string' && r.orig_hint !== '' ? r.orig_hint : null,
      paths: Array.isArray(r.paths) ? r.paths : null,
    };
  });
  const candidate = {
    formatVersion: 1,
    id: meta.id,
    date: meta.date,
    title: meta.title,
    difficulty: meta.difficulty,
    width: meta.width,
    height: meta.height,
    initialReveals: meta.initialReveals,
    source: 'cluesbysam.com',
    people,
  };
  try {
    return validatePuzzle(candidate);
  } catch (e) {
    if (e instanceof PuzzleValidationError) throw new ExtractError('validation', e.message);
    throw e;
  }
}
