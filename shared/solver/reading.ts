import type { Shape } from './enumerate';
import { neighbors } from './grid';
import type { Hint } from './hint';
import { evaluate, makeBoard, unitMembers, unitsOfKind } from './predicates';
import { type Clues, forcedGiven } from './solve';

/** Past this many unknown cards in a clue's support, `entailedByKnown` stops
 * enumerating and answers false: 2^16 evaluations is the most it will spend. */
const MAX_ENTAILMENT_FREE = 16;

/** Predicates whose truth reads every unit of a kind, or the whole board. */
const WHOLE_BOARD = new Set([
  'number_of_traits',
  'has_most_traits',
  'only_unit_has_exactly_n_traits',
  'only_unit_has_less_than_n_traits',
  'only_unit_has_more_than_n_traits',
]);

/**
 * Every card whose value can change whether `hint` holds — over-approximated,
 * which only costs `entailedByKnown` time, never correctness. A unit's members
 * and their neighbours cover the neighbour-count and directional families, whose
 * offsets are all one step.
 */
export function hintSupport(shape: Shape, hint: Hint): number[] {
  const board = makeBoard(shape.grid, shape.professions, shape.professions.map(() => false));
  const all = [...Array(shape.grid.size).keys()];
  if (WHOLE_BOARD.has(hint.pred)) return all;
  const out = new Set<number>();
  const take = (members: number[]) => {
    for (const i of members) {
      out.add(i);
      for (const j of neighbors(shape.grid, i)) out.add(j);
    }
  };
  for (const a of hint.args) {
    if (a.t === 'unit') take(unitMembers(board, a.unit));
    else if (a.t === 'index') out.add(a.i);
    else if (a.t === 'kind') for (const u of unitsOfKind(board, a.kind)) take(unitMembers(board, u));
    else if (a.t === 'profession') take(unitMembers(board, { kind: 'profession', name: a.name }));
  }
  return [...out].sort((x, y) => x - y);
}

/**
 * True when the known cards already settle `hint`: it holds on every way of
 * filling in the rest. A clue like that tells the player nothing they could not
 * read off the board — "there are 2 criminals in row 3" once row 3 is face up.
 * Conservative: answers false when the support is too open to enumerate.
 */
export function entailedByKnown(
  shape: Shape,
  hint: Hint,
  truth: boolean[],
  flipped: Iterable<number>,
): boolean {
  const known = new Set(flipped);
  const free = hintSupport(shape, hint).filter((i) => !known.has(i));
  if (free.length > MAX_ENTAILMENT_FREE) return false;
  const criminal = [...truth];
  const board = makeBoard(shape.grid, shape.professions, criminal);
  for (let mask = 0; mask < 1 << free.length; mask++) {
    free.forEach((i, k) => {
      criminal[i] = ((mask >> k) & 1) === 1;
    });
    if (!evaluate(board, hint)) return false;
  }
  return true;
}

/** One clue as the player meets it. */
export interface ClueRead {
  /** The card carrying the clue. */
  host: number;
  /** Cards newly forced by reading this clue, on top of everything read before it. */
  gain: number[];
  /** Cards this clue forces on its own, from the known cards alone. */
  solo: number[];
  /** Whether the known cards already settled it when it was read. */
  dead: boolean;
  /**
   * For a clue that opened nothing when read: the host of the first later clue
   * that opens less without it — the clue it was setting up — or null if none
   * ever does. Undefined for a clue that opened something.
   */
  feeds?: number | null;
}

/**
 * Replay a puzzle in the order a player meets its clues.
 *
 * `solveChain` closes over the board in waves, applying every visible clue at
 * once; that proves a puzzle solvable but hides what any one sentence did. A
 * player reads one clue at a time, as its card comes up, and flips what
 * follows. So: clues are read first-come first-served — by the order their
 * cards were flipped, ties broken by board index — and after each one every
 * card the clues read so far force is flipped and its clue joins the queue.
 *
 * The order is a model, not the order a given player uses; it is the same model
 * for the archive and for generated puzzles, which is what makes their numbers
 * comparable.
 */
export function readingReplay(
  shape: Shape,
  clues: Clues,
  truth: boolean[],
  initialReveals: number[],
  traceSetups = true,
): ClueRead[] {
  const size = shape.grid.size;
  const flipped = new Set(initialReveals);
  const read: Clues = clues.map(() => null);
  const queue = [...initialReveals].filter((i) => clues[i] !== null).sort((a, b) => a - b);
  const out: ClueRead[] = [];

  while (queue.length > 0) {
    const host = queue.shift() as number;
    read[host] = clues[host];
    const at = [...flipped];
    const forced = forcedGiven(shape, read, truth, at);
    const alone = forcedGiven(
      shape,
      clues.map((h, i) => (i === host ? h : null)),
      truth,
      at,
    );
    const gain: number[] = [];
    const solo: number[] = [];
    for (let i = 0; i < size; i++) {
      if (flipped.has(i)) continue;
      if (forced[i] !== null) gain.push(i);
      if (alone[i] !== null) solo.push(i);
    }
    for (const i of gain) {
      flipped.add(i);
      if (clues[i] !== null) queue.push(i);
    }
    out.push({ host, gain, solo, dead: entailedByKnown(shape, clues[host] as Hint, truth, at) });
  }
  if (!traceSetups) return out;

  // A clue that opens nothing is a setup when some later read needs it. Taking
  // it away cannot change which cards come up before it, nor the order clues
  // are read in up to the read that needed it, so the first read whose gain
  // shrinks is the one it fed.
  out.forEach((r, k) => {
    if (r.gain.length > 0) return;
    const without = readingReplay(
      shape,
      clues.map((h, i) => (i === r.host ? null : h)),
      truth,
      initialReveals,
      false,
    );
    const gainWithout = new Map(without.map((w) => [w.host, w.gain.length]));
    const fed = out.slice(k + 1).find((later) => gainWithout.get(later.host) !== later.gain.length);
    r.feeds = fed ? fed.host : null;
  });
  return out;
}
