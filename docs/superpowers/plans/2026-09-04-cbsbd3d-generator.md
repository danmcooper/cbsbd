# cbsbd3d Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the cbsbd3d repo and its puzzle generator, so that `npm run generate` writes a valid, uniquely-solvable 3x3x3 puzzle file for a date and `npm run audit` re-derives and checks every committed file.

**Architecture:** Fork `shared/solver/` out of the `cbs2` repo (at `/Users/dan/code/cbsbd`) and replace its 2D geometry with a cube lattice. `sat.ts`, `cardinality.ts`, `encode.ts`, `clues.ts` and `solve.ts` never mention a coordinate — they work on member index lists — so they port unchanged. `grid.ts` is replaced by `lattice.ts`; `hint.ts`, `predicates.ts`, `render.ts` and `candidates.ts` learn the cube's units and words. Calibration inputs that cbsbd3d cannot compute for itself (difficulty bands, clue mix) are vendored as committed JSON.

**Tech Stack:** TypeScript, Vitest, tsx, Node. No runtime dependencies in this plan — the generator is scripts and pure functions.

**Spec:** `docs/superpowers/specs/2026-09-04-cbsbd3d-design.md` (in the `cbs2` repo; copy it into cbsbd3d as part of Task 1)

**Source repo for the fork:** `/Users/dan/code/cbsbd` — referred to below as `cbs2`. Read files from it; never edit it.

## Global Constraints

- Node 22+, TypeScript 6, Vitest 4, tsx 4. Match `cbs2/package.json` versions exactly.
- `"type": "module"` — all imports are ESM, all script files are `.mts`.
- Board is always 3x3x3. 27 cells. No other size, ever.
- Cell index is `i = z*9 + y*3 + x`. `x` 0-2 renders `A`-`C` left to right; `y` 0-2 renders `1`-`3` top to bottom; `z` 0-2 renders `a`-`c` front to back.
- Addresses are lower-case depth: `A1a`, `B2b`, `C3c`. Never `A1A`.
- Names are dealt alphabetically in index order, so a suspect's initial letter gives their position in reading order.
- Clue text is third person about named suspects ("2 criminals are behind cleo"), never first person.
- Neighbours are face-neighbours only. No diagonals.
- Generation is unaimed: `labelOf` always supplied, nothing discarded for missing a band.
- Every generated file is reproducible from its own filename. `npm run audit` is the check.
- British spelling in clue text and comments ("neighbour"), matching cbs2. Identifiers stay American (`neighbors`, `hneighbor`) where they port from cbs2 code.

---

### Task 1: Repo scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `README.md`
- Create: `docs/superpowers/specs/2026-09-04-cbsbd3d-design.md` (copy from cbs2)
- Create: `shared/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a repo where `npm test` runs Vitest over `shared/**/*.test.ts` and `scripts/**/*.test.mts`.

- [ ] **Step 1: Create the repo and copy the spec**

```bash
mkdir -p ~/code/cbsbd3d && cd ~/code/cbsbd3d && git init
mkdir -p shared/solver scripts config puzzles docs/superpowers/specs
cp ~/code/cbsbd/docs/superpowers/specs/2026-09-04-cbsbd3d-design.md docs/superpowers/specs/
```

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "cbsbd3d",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "generate": "tsx scripts/generate.mts",
    "manifest": "tsx scripts/manifest.mts",
    "audit": "tsx scripts/audit.mts"
  },
  "devDependencies": {
    "@types/node": "^26.1.0",
    "tsx": "^4.23.0",
    "typescript": "^6.0.3",
    "vitest": "^4.1.10"
  }
}
```

Copy `tsconfig.json` and `vitest.config.ts` from cbs2 verbatim, then delete any React/jsdom settings from them — this repo has no DOM yet. `.gitignore` holds `node_modules` and `dist`.

- [ ] **Step 3: Write a smoke test**

```ts
// shared/smoke.test.ts
import { expect, it } from 'vitest';

it('runs', () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 4: Install and run**

Run: `npm install && npm test`
Expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Scaffold the cbsbd3d repo"
```

---

### Task 2: The lattice

**Files:**
- Create: `shared/solver/lattice.ts`
- Test: `shared/solver/lattice.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface Lattice { size: 27 }` — a marker type, so signatures read like cbs2's and a second geometry could be slotted in later.
  - `const LATTICE: Lattice`
  - `type Dir = readonly [number, number, number]`
  - `const DIRS: Record<'up'|'down'|'left'|'right'|'front'|'behind', Dir>`
  - `xOf(i)`, `yOf(i)`, `zOf(i)`, `indexOf(x, y, z)`, `addressOf(i): string`, `indexOfAddress(a: string): number`
  - `offsetIndex(g, i, d: Dir): number | null`
  - `rowMembers(g, n)`, `colMembers(g, n)`, `sliceMembers(g, n)` — all 1-based `n`, all 9 members
  - `reachMembers(g, i, d: Dir): number[]`
  - `hNeighbors(g, i)`, `vNeighbors(g, i)`, `adjacent(g, i, j): boolean`
  - `segment(g, a, b)`, `cornerMembers(g)`, `edgeMembers(g)`, `faceMembers(g)`, `coreMembers(g)`
  - `isConnected(g, members)` — uses `adjacent`

- [ ] **Step 1: Write the failing tests**

```ts
// shared/solver/lattice.test.ts
import { describe, expect, it } from 'vitest';
import {
  DIRS, LATTICE, addressOf, adjacent, colMembers, coreMembers, cornerMembers,
  edgeMembers, faceMembers, hNeighbors, indexOf, indexOfAddress, reachMembers,
  rowMembers, segment, sliceMembers, vNeighbors, xOf, yOf, zOf,
} from './lattice';

const g = LATTICE;

describe('addresses', () => {
  it('places A1a at the near top left and C3c at the far bottom right', () => {
    expect(addressOf(0)).toBe('A1a');
    expect(addressOf(26)).toBe('C3c');
    expect(addressOf(indexOf(1, 1, 1))).toBe('B2b');
  });

  it('round-trips every cell', () => {
    for (let i = 0; i < 27; i++) expect(indexOfAddress(addressOf(i))).toBe(i);
  });

  it('runs left to right, then top to bottom, then front to back', () => {
    expect([0, 1, 2].map(addressOf)).toEqual(['A1a', 'B1a', 'C1a']);
    expect(addressOf(3)).toBe('A2a');
    expect(addressOf(9)).toBe('A1b');
  });

  it('decomposes an index into coordinates', () => {
    expect([xOf(13), yOf(13), zOf(13)]).toEqual([1, 1, 1]);
  });
});

describe('slabs', () => {
  it('gives nine members each', () => {
    for (const n of [1, 2, 3]) {
      expect(rowMembers(g, n)).toHaveLength(9);
      expect(colMembers(g, n)).toHaveLength(9);
      expect(sliceMembers(g, n)).toHaveLength(9);
    }
  });

  it('spans every depth in a row and every row in a slice', () => {
    expect(rowMembers(g, 1).map(addressOf)).toContain('C1c');
    expect(sliceMembers(g, 1).every((i) => zOf(i) === 0)).toBe(true);
    expect(colMembers(g, 1).every((i) => xOf(i) === 0)).toBe(true);
  });
});

describe('reach', () => {
  it('sees nine from the middle and eighteen from the far side', () => {
    expect(reachMembers(g, indexOfAddress('B2b'), DIRS.up)).toHaveLength(9);
    expect(reachMembers(g, indexOfAddress('B3b'), DIRS.up)).toHaveLength(18);
  });

  it('is empty at the edge it faces', () => {
    expect(reachMembers(g, indexOfAddress('B1b'), DIRS.up)).toEqual([]);
    expect(reachMembers(g, indexOfAddress('A2b'), DIRS.left)).toEqual([]);
  });

  it('takes the whole slab regardless of the anchor column or depth', () => {
    expect(reachMembers(g, indexOfAddress('B2b'), DIRS.up)).toEqual(rowMembers(g, 1));
    expect(reachMembers(g, indexOfAddress('B2b'), DIRS.behind)).toEqual(sliceMembers(g, 3));
  });
});

describe('neighbours', () => {
  it('gives a corner two horizontal and one vertical', () => {
    const a1a = indexOfAddress('A1a');
    expect(hNeighbors(g, a1a).map(addressOf)).toEqual(['B1a', 'A1b']);
    expect(vNeighbors(g, a1a).map(addressOf)).toEqual(['A2a']);
  });

  it('gives the core four horizontal and two vertical', () => {
    const b2b = indexOfAddress('B2b');
    expect(hNeighbors(g, b2b)).toHaveLength(4);
    expect(vNeighbors(g, b2b)).toHaveLength(2);
  });

  it('never returns a diagonal', () => {
    expect(adjacent(g, indexOfAddress('A1a'), indexOfAddress('B2a'))).toBe(false);
    expect(adjacent(g, indexOfAddress('A1a'), indexOfAddress('A2a'))).toBe(true);
  });
});

describe('position groups', () => {
  it('partitions all 27 cells', () => {
    const groups = [cornerMembers(g), edgeMembers(g), faceMembers(g), coreMembers(g)];
    expect(groups.map((m) => m.length)).toEqual([8, 12, 6, 1]);
    expect(new Set(groups.flat()).size).toBe(27);
  });

  it('puts B2b alone in the core', () => {
    expect(coreMembers(g).map(addressOf)).toEqual(['B2b']);
  });
});

describe('segment', () => {
  it('runs along an axis and is empty otherwise', () => {
    expect(segment(g, indexOfAddress('A1a'), indexOfAddress('C1a')).map(addressOf))
      .toEqual(['A1a', 'B1a', 'C1a']);
    expect(segment(g, indexOfAddress('A1a'), indexOfAddress('B2b'))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run shared/solver/lattice.test.ts`
Expected: FAIL — cannot resolve `./lattice`.

- [ ] **Step 3: Write `lattice.ts`**

Key parts; fill the rest by the same pattern.

```ts
export interface Lattice {
  size: 27;
}

export const LATTICE: Lattice = { size: 27 };

export type Dir = readonly [number, number, number];

export const DIRS = {
  up: [0, -1, 0], down: [0, 1, 0],
  left: [-1, 0, 0], right: [1, 0, 0],
  front: [0, 0, -1], behind: [0, 0, 1],
} as const satisfies Record<string, Dir>;

export const xOf = (i: number): number => i % 3;
export const yOf = (i: number): number => Math.floor(i / 3) % 3;
export const zOf = (i: number): number => Math.floor(i / 9);
export const indexOf = (x: number, y: number, z: number): number => z * 9 + y * 3 + x;

export function addressOf(i: number): string {
  return `${'ABC'[xOf(i)]}${yOf(i) + 1}${'abc'[zOf(i)]}`;
}

export function indexOfAddress(a: string): number {
  const x = 'ABC'.indexOf(a[0]);
  const y = Number(a[1]) - 1;
  const z = 'abc'.indexOf(a[2]);
  if (x < 0 || z < 0 || y < 0 || y > 2) throw new Error(`bad address: ${a}`);
  return indexOf(x, y, z);
}

export function offsetIndex(g: Lattice, i: number, d: Dir): number | null {
  const x = xOf(i) + d[0];
  const y = yOf(i) + d[1];
  const z = zOf(i) + d[2];
  if (x < 0 || x > 2 || y < 0 || y > 2 || z < 0 || z > 2) return null;
  return indexOf(x, y, z);
}

/** Every cell past `i` in direction `d`, whole slabs at a time: 18, 9 or none. */
export function reachMembers(g: Lattice, i: number, d: Dir): number[] {
  const axis = d[0] !== 0 ? xOf(i) : d[1] !== 0 ? yOf(i) : zOf(i);
  const step = d[0] || d[1] || d[2];
  const out: number[] = [];
  for (let n = axis + step; n >= 0 && n <= 2; n += step) {
    out.push(...(d[0] !== 0 ? colMembers(g, n + 1) : d[1] !== 0 ? rowMembers(g, n + 1) : sliceMembers(g, n + 1)));
  }
  return out.sort((a, b) => a - b);
}

export function hNeighbors(g: Lattice, i: number): number[] {
  return [DIRS.left, DIRS.right, DIRS.front, DIRS.behind]
    .map((d) => offsetIndex(g, i, d))
    .filter((j): j is number => j !== null)
    .sort((a, b) => a - b);
}

export function vNeighbors(g: Lattice, i: number): number[] {
  return [DIRS.up, DIRS.down]
    .map((d) => offsetIndex(g, i, d))
    .filter((j): j is number => j !== null)
    .sort((a, b) => a - b);
}

export const adjacent = (g: Lattice, i: number, j: number): boolean =>
  hNeighbors(g, i).includes(j) || vNeighbors(g, i).includes(j);
```

Position groups are read off how many coordinates sit at an extreme: count `c = [x,y,z].filter(v => v === 0 || v === 2).length`. `c === 3` is a corner, `2` an edge, `1` a face centre, `0` the core. `segment` returns `[]` unless the two cells agree on two of three coordinates; otherwise it walks the differing axis inclusively. `isConnected` is cbs2's flood fill with `adjacent` in place of `neighbors`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run shared/solver/lattice.test.ts`
Expected: PASS, all describes green.

- [ ] **Step 5: Commit**

```bash
git add shared/solver/lattice.ts shared/solver/lattice.test.ts
git commit -m "Add the 3x3x3 lattice"
```

---

### Task 3: The hint AST

**Files:**
- Create: `shared/solver/hint.ts` (fork of `cbs2/shared/solver/hint.ts`)
- Test: `shared/solver/hint.test.ts` (fork of cbs2's, extended)

**Interfaces:**
- Consumes: `Dir` from `./lattice`.
- Produces: `Trait`, `UnitKind`, `Unit`, `HintArg`, `Hint`, `ARG_KINDS`, `parseHint`, `formatHint`, `HintParseError` — same names and shapes as cbs2, with the cube's unit kinds.

- [ ] **Step 1: Copy cbs2's `hint.ts` and `hint.test.ts` and change the types**

```ts
export type UnitKind =
  | 'row' | 'col' | 'slice'
  | 'hneighbor' | 'vneighbor' | 'reach'
  | 'between' | 'profession'
  | 'corner' | 'edge' | 'face' | 'core';

export type Unit =
  | { kind: 'row'; n: number }
  | { kind: 'col'; n: number }
  | { kind: 'slice'; n: number }
  | { kind: 'hneighbor'; i: number }
  | { kind: 'vneighbor'; i: number }
  | { kind: 'reach'; i: number; dir: Dir }
  | { kind: 'between'; a: number; b: number }
  | { kind: 'profession'; name: string }
  | { kind: 'corner' }
  | { kind: 'edge' }
  | { kind: 'face' }
  | { kind: 'core' };
```

`ARG_KINDS` is unchanged except the three directional predicates, which gain one `num`:

```ts
  n_in_unit_have_trait_in_dir: [U, T, N, N, N, N],
  n_t_in_unit_have_trait_in_dir: [U, T, T, N, N, N, N],
  n_professions_have_trait_in_dir: [P, T, N, N, N, N],
```

- [ ] **Step 2: Write the failing tests for the new serialisations**

```ts
it('round-trips a reach unit', () => {
  const s = 'number_of_traits_in_unit(unit(reach,13:0,-1,0),criminal,2)';
  expect(formatHint(parseHint(s))).toBe(s);
});

it('round-trips a slice unit', () => {
  const s = 'number_of_traits_in_unit(unit(slice,2),criminal,1)';
  expect(formatHint(parseHint(s))).toBe(s);
});

it('keeps the two neighbour kinds apart', () => {
  expect(parseHint('odd_number_of_traits_in_unit(unit(hneighbor,4),criminal)').args[0])
    .toEqual({ t: 'unit', unit: { kind: 'hneighbor', i: 4 } });
});

it('carries three direction components', () => {
  expect(parseHint('n_professions_have_trait_in_dir(cook,criminal,1,0,0,1)').args)
    .toHaveLength(6);
});

it('rejects an unknown unit kind', () => {
  expect(() => parseHint('number_of_traits_in_unit(unit(diagonal,1),criminal,1)'))
    .toThrow(HintParseError);
});
```

A `reach` unit serialises as `unit(reach,<i>:<dx>,<dy>,<dz>)` — the colon keeps the anchor and the direction apart inside one unit argument, so `splitArgs` (which splits on top-level commas) needs no change.

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run shared/solver/hint.test.ts`
Expected: FAIL on the reach and slice round-trips.

- [ ] **Step 4: Extend `parseUnit` and the unit formatter**

```ts
function parseUnit(s: string): Unit {
  const m = /^unit\((\w+),(.*)\)$/.exec(s);
  if (!m) throw new HintParseError(`not a unit: ${s}`);
  const [, kind, arg] = m;
  switch (kind) {
    case 'row': case 'col': case 'slice':
      return { kind, n: Number(arg) };
    case 'hneighbor': case 'vneighbor':
      return { kind, i: Number(arg) };
    case 'reach': {
      const r = /^(\d+):(-?\d+),(-?\d+),(-?\d+)$/.exec(arg);
      if (!r) throw new HintParseError(`not a reach: ${arg}`);
      return { kind, i: Number(r[1]), dir: [Number(r[2]), Number(r[3]), Number(r[4])] };
    }
    case 'corner': case 'edge': case 'face': case 'core':
      return { kind };
    // between and profession port from cbs2 unchanged
    default:
      throw new HintParseError(`unknown unit kind: ${kind}`);
  }
}
```

- [ ] **Step 5: Run and commit**

Run: `npx vitest run shared/solver/hint.test.ts`
Expected: PASS.

```bash
git add shared/solver/hint.ts shared/solver/hint.test.ts
git commit -m "Teach the hint AST the cube's units"
```

---

### Task 4: Predicates over the lattice

**Files:**
- Create: `shared/solver/predicates.ts` (fork of cbs2's)
- Test: `shared/solver/predicates.test.ts` (fork, re-pointed)

**Interfaces:**
- Consumes: `lattice.ts`, `hint.ts`.
- Produces: `Board { lattice: Lattice; professions: string[]; criminal: boolean[]; cache?: Map<string, number[]> }`, `makeBoard(professions, criminal)`, `unitMembers`, `unitsOfKind`, `hasTrait`, `countTrait`, `hintFeatures`, `EVALUATORS`, `evaluate`, `UnknownPredicateError`.

Note `makeBoard` drops cbs2's first parameter: there is only one lattice.

- [ ] **Step 1: Write the failing tests**

```ts
import { LATTICE, addressOf, indexOfAddress } from './lattice';
import { evaluate, makeBoard, unitMembers, unitsOfKind } from './predicates';
import { parseHint } from './hint';

const professions = Array.from({ length: 27 }, (_, i) => (i % 3 === 0 ? 'cook' : 'cop'));
const noCriminals = Array.from({ length: 27 }, () => false);

it('resolves every unit kind to members', () => {
  const b = makeBoard(professions, noCriminals);
  expect(unitMembers(b, { kind: 'slice', n: 2 })).toHaveLength(9);
  expect(unitMembers(b, { kind: 'reach', i: indexOfAddress('B2b'), dir: [0, -1, 0] })).toHaveLength(9);
  expect(unitMembers(b, { kind: 'core' }).map(addressOf)).toEqual(['B2b']);
  expect(unitMembers(b, { kind: 'vneighbor', i: indexOfAddress('A1a') })).toHaveLength(1);
});

it('enumerates three units for each slab kind', () => {
  const b = makeBoard(professions, noCriminals);
  for (const kind of ['row', 'col', 'slice'] as const) {
    expect(unitsOfKind(b, kind)).toHaveLength(3);
  }
});

it('counts a trait in a direction across the depth axis', () => {
  const criminal = noCriminals.slice();
  criminal[indexOfAddress('B2c')] = true;
  const b = makeBoard(professions, criminal);
  // exactly 1 card in slice b has a criminal directly behind them
  expect(evaluate(b, parseHint('n_in_unit_have_trait_in_dir(unit(slice,2),criminal,1,0,0,1)'))).toBe(true);
});

it('reads adjacency as face contact, not diagonal', () => {
  const criminal = noCriminals.slice();
  criminal[indexOfAddress('A1a')] = true;
  criminal[indexOfAddress('B2a')] = true;
  const b = makeBoard(professions, criminal);
  expect(evaluate(b, parseHint('both_traits_are_neighbors_in_unit(unit(slice,1),criminal)'))).toBe(false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run shared/solver/predicates.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Port `predicates.ts`**

Copy cbs2's file, then:

```ts
function computeUnitMembers(b: Board, u: Unit): number[] {
  switch (u.kind) {
    case 'row': return rowMembers(b.lattice, u.n);
    case 'col': return colMembers(b.lattice, u.n);
    case 'slice': return sliceMembers(b.lattice, u.n);
    case 'hneighbor': return hNeighbors(b.lattice, u.i);
    case 'vneighbor': return vNeighbors(b.lattice, u.i);
    case 'reach': return reachMembers(b.lattice, u.i, u.dir);
    case 'between': return segment(b.lattice, u.a, u.b);
    case 'profession': return b.professions.flatMap((p, i) => (p === u.name ? [i] : []));
    case 'corner': return cornerMembers(b.lattice);
    case 'edge': return edgeMembers(b.lattice);
    case 'face': return faceMembers(b.lattice);
    case 'core': return coreMembers(b.lattice);
  }
}
```

`inDirCount` takes `(b, members, t, dx, dy, dz)` and calls `offsetIndex(b.lattice, i, [dx, dy, dz])`. The four adjacency-relation predicates — `max_number_of_traits_in_neighbors_in_unit`, `only_one_person_in_unit_has_exactly_n_trait_neighbors`, `both_traits_are_neighbors_in_unit`, `all_traits_are_neighbors_in_unit` — take their neighbour set from `hNeighbors(...).concat(vNeighbors(...))`, i.e. face contact in any direction. `hintFeatures` emits `unit:<kind>` as before and `dir:<dx>,<dy>,<dz>` for the directional families. `unitsOfKind` returns three units for each of row/col/slice, one each for corner/edge/face/core, one per profession, and one per card for the anchored kinds.

- [ ] **Step 4: Run and confirm**

Run: `npx vitest run shared/solver/predicates.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/solver/predicates.ts shared/solver/predicates.test.ts
git commit -m "Evaluate predicates against the lattice"
```

---

### Task 5: Port the geometry-free core

**Files:**
- Create: `shared/solver/sat.ts`, `cardinality.ts`, `encode.ts`, `clues.ts`, `solve.ts`, `enumerate.ts`, `corpus.ts` (forks of cbs2's)
- Test: the matching `*.test.ts` files, forked

**Interfaces:**
- Consumes: `predicates.ts`, `hint.ts`.
- Produces: `Cnf`, `encode`, `supports`, `SUPPORTED`, `MAX_ENUMERATED_UNIT`, `forcedGiven`, `isUniquelySolvable`, `solveChain`, `hintSteps`, `minimalPaths`, `parseClues`, `activeHints`, `knownFrom` — all with cbs2's signatures. Plus, from `corpus.ts`: `boardFor(puzzle: Puzzle): Board`, `isSelfReferential`, `CROSS_TRAIT`, `CROSS_TRAIT_RATE`.

These files never mention a coordinate. The only edits are import paths and the `makeBoard` arity change.

`corpus.ts` is the exception and is forked **minus its archive reading**: delete `loadArchive`, `archiveClueMix`, `ArchivePuzzle` and `PUZZLES_DIR`, which read the scraped 4x5 archive this repo does not have. Keep `boardFor` (Task 12 needs it to re-derive a board from a file) and `CROSS_TRAIT` / `CROSS_TRAIT_RATE` (Task 7's `candidates.ts` imports them). `ClueMix` moves out of this file entirely — it lives in `mix.ts`, Task 9.

- [ ] **Step 1: Copy the files and their tests**

```bash
cd ~/code/cbsbd3d
for f in sat cardinality encode clues solve enumerate corpus; do
  cp ~/code/cbsbd/shared/solver/$f.ts shared/solver/
done
cp ~/code/cbsbd/shared/solver/sat.test.ts ~/code/cbsbd/shared/solver/sat.differential.test.ts \
   ~/code/cbsbd/shared/solver/cardinality.test.ts ~/code/cbsbd/shared/solver/encode.test.ts \
   ~/code/cbsbd/shared/solver/solve.test.ts ~/code/cbsbd/shared/solver/enumerate.test.ts shared/solver/
```

- [ ] **Step 2: Run to see what breaks**

Run: `npx vitest run shared/solver`
Expected: FAIL — every `makeBoard(grid, ...)` call and every `Shape`/board-size reference built from `width`/`height`.

- [ ] **Step 3: Fix the call sites**

Replace `makeBoard(grid, professions, criminal)` with `makeBoard(professions, criminal)` throughout, and any `makeGrid(w, h)` with `LATTICE`. Test fixtures that built a 3x3 board of 9 cards become 27-card boards; where a test asserts a specific count that depended on board size, recompute it for 27 rather than deleting the assertion.

- [ ] **Step 4: Run the suite**

Run: `npx vitest run shared/solver`
Expected: PASS.

Note for later tasks: `MAX_ENUMERATED_UNIT` is 16, and an 18-cell reach exceeds it. Structural predicates on such a unit are *refused* by `supports()`, not mis-encoded — that is correct behaviour and must not be "fixed" by raising the ceiling. Task 7 relies on it.

- [ ] **Step 5: Commit**

```bash
git add shared/solver
git commit -m "Port the SAT core, unchanged but for the board's arity"
```

---

### Task 6: Rendering the cube's words

**Files:**
- Create: `shared/solver/render.ts` (fork of cbs2's)
- Test: `shared/solver/render.test.ts` (fork, extended)

**Interfaces:**
- Consumes: `hint.ts`.
- Produces: `render(h, options)`, `canRender`, `where(u)`, `wherePerson(u)`, `dirPhrase(dx, dy, dz)`, `plural`, `RENDERERS`, `RenderOptions`, `UnsupportedShapeError`.

- [ ] **Step 1: Write the failing tests**

```ts
import { dirPhrase, where } from './render';

it('names each slab by its address letter or digit', () => {
  expect(where({ kind: 'row', n: 2 })).toBe('in row 2');
  expect(where({ kind: 'col', n: 2 })).toBe('in column B');
  expect(where({ kind: 'slice', n: 2 })).toBe('in slice b');
});

it('names the position groups', () => {
  expect(where({ kind: 'corner' })).toBe('in a corner');
  expect(where({ kind: 'edge' })).toBe('on an edge');
  expect(where({ kind: 'face' })).toBe('at a face centre');
  expect(where({ kind: 'core' })).toBe('in the core');
});

it('says the six single steps', () => {
  expect(dirPhrase(0, -1, 0)).toBe('directly above them');
  expect(dirPhrase(0, 1, 0)).toBe('directly below them');
  expect(dirPhrase(-1, 0, 0)).toBe('directly to the left of them');
  expect(dirPhrase(1, 0, 0)).toBe('directly to the right of them');
  expect(dirPhrase(0, 0, -1)).toBe('directly in front of them');
  expect(dirPhrase(0, 0, 1)).toBe('directly behind them');
});

it('says the six wide reaches', () => {
  const r = (dir: readonly [number, number, number]) => where({ kind: 'reach', i: 13, dir });
  expect(r([0, -1, 0])).toBe('above #NAME:13');
  expect(r([0, 0, 1])).toBe('behind #NAME:13');
  expect(r([-1, 0, 0])).toBe('to the left of #NAME:13');
});

it('distinguishes the two neighbour kinds', () => {
  expect(where({ kind: 'hneighbor', i: 4 })).toBe('among the horizontal neighbours of #NAME:4');
  expect(where({ kind: 'vneighbor', i: 4 })).toBe('among the vertical neighbours of #NAME:4');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run shared/solver/render.test.ts`
Expected: FAIL on every new phrase.

- [ ] **Step 3: Write the phrases**

```ts
const SLAB: Record<'row' | 'col' | 'slice', (n: number) => string> = {
  row: (n) => `in row ${n}`,
  col: (n) => `in column ${'ABC'[n - 1]}`,
  slice: (n) => `in slice ${'abc'[n - 1]}`,
};

const WIDE: Record<string, string> = {
  '0,-1,0': 'above', '0,1,0': 'below',
  '-1,0,0': 'to the left of', '1,0,0': 'to the right of',
  '0,0,-1': 'in front of', '0,0,1': 'behind',
};

export function dirPhrase(dx: number, dy: number, dz: number): string {
  const wide = WIDE[`${dx},${dy},${dz}`];
  if (!wide) throw new UnsupportedShapeError(`no phrase for direction ${dx},${dy},${dz}`);
  return `directly ${wide} them`;
}
```

`where` for a reach reads `${WIDE[key]} #NAME:${u.i}`. Everything else ports from cbs2 unchanged.

- [ ] **Step 4: Run and confirm**

Run: `npx vitest run shared/solver/render.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/solver/render.ts shared/solver/render.test.ts
git commit -m "Render the cube's directions and slabs"
```

---

### Task 7: Candidate generation

**Files:**
- Create: `shared/solver/candidates.ts` (fork of cbs2's)
- Test: `shared/solver/candidates.test.ts` (fork, extended)

**Interfaces:**
- Consumes: `predicates.ts`, `hint.ts`, `lattice.ts`.
- Produces: `candidateUnits(b): Unit[]`, `candidateHints(b): Hint[]`, `referencedCards`, `namedCards`.

- [ ] **Step 1: Write the failing tests**

```ts
it('offers every unit kind the cube has', () => {
  const kinds = new Set(candidateUnits(board).map((u) => u.kind));
  for (const k of ['row', 'col', 'slice', 'hneighbor', 'vneighbor', 'reach', 'corner', 'edge', 'face', 'core']) {
    expect(kinds).toContain(k);
  }
});

it('never offers an empty reach', () => {
  const reaches = candidateUnits(board).filter((u) => u.kind === 'reach');
  expect(reaches.length).toBeGreaterThan(0);
  for (const u of reaches) expect(unitMembers(board, u).length).toBeGreaterThan(0);
});

it('offers only the six single steps as directions', () => {
  const dirs = new Set(
    candidateHints(board)
      .filter((h) => h.pred.endsWith('_in_dir'))
      .map((h) => h.args.slice(-3).map((a) => (a as { n: number }).n).join(',')),
  );
  expect([...dirs].sort()).toEqual(['-1,0,0', '0,-1,0', '0,0,-1', '0,0,1', '0,1,0', '1,0,0']);
});

it('produces only encodable or renderable hints', () => {
  for (const h of candidateHints(board)) expect(canRender(h)).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run shared/solver/candidates.test.ts`
Expected: FAIL on unit kinds and directions.

- [ ] **Step 3: Extend `candidateUnits` and the directional families**

`candidateUnits` gains: three `slice` units; per card, one `hneighbor`, one `vneighbor`, and one `reach` per direction *whose members are non-empty*; and the four position groups. The `between` enumeration keeps cbs2's shape but walks all three axes. The directional predicates iterate `Object.values(DIRS)` instead of the four 2D offsets.

Structural predicates (the ones in cbs2's subset-walking set) must skip units larger than `MAX_ENUMERATED_UNIT`, which drops 18-cell reaches from those families only. Assert this rather than work around it:

```ts
it('keeps structural predicates off an 18-cell reach', () => {
  const big = { kind: 'reach', i: indexOfAddress('B3b'), dir: DIRS.up } as const;
  const structural = candidateHints(board).filter(
    (h) => h.pred === 'all_traits_are_neighbors_in_unit' &&
      formatHint(h).includes(formatUnit(big)),
  );
  expect(structural).toEqual([]);
});
```

- [ ] **Step 4: Run and confirm**

Run: `npx vitest run shared/solver/candidates.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/solver/candidates.ts shared/solver/candidates.test.ts
git commit -m "Propose candidate clues over the cube's units"
```

---

### Task 8: Vocabulary and the alphabetical cast

**Files:**
- Create: `shared/solver/vocab.ts` (fork of cbs2's, trimmed)
- Test: `shared/solver/vocab.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `VocabPerson`, `VocabProfession`, `NAMES`, `PROFESSIONS`, `namesFor(size)`, `professionsFor(size)`, `faceOf(profession, gender)`, `TITLES`, `FLAVOUR`.

cbs2's tiered `EXTRA_NAMES` / `WIDE_PROFESSIONS` gating exists to seat boards from 12 to 100 cards. This repo has one board size, so the tiers go: keep `NAMES` and `PROFESSIONS`, delete the extras and the `*For(size)` gating logic, but keep the function names so ported call sites do not change.

- [ ] **Step 1: Write the failing test**

```ts
it('seats 27 cards with one name per initial letter', () => {
  const initials = NAMES.map((p) => p.name[0]);
  expect(NAMES.length).toBeGreaterThanOrEqual(27);
  expect(new Set(initials).size).toBeGreaterThanOrEqual(26);
});

it('has enough professions to keep groups near two or three', () => {
  expect(PROFESSIONS.length).toBeGreaterThanOrEqual(9);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run shared/solver/vocab.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Port and trim `vocab.ts`**

Copy cbs2's `NAMES` and `EXTRA_NAMES` into one `NAMES` list, keeping at least one entry per initial letter; copy `PROFESSIONS` and `EXTRA_PROFESSIONS` into one `PROFESSIONS` list. `namesFor` and `professionsFor` return the whole list regardless of `size`.

- [ ] **Step 4: Run and confirm**

Run: `npx vitest run shared/solver/vocab.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/solver/vocab.ts shared/solver/vocab.test.ts
git commit -m "Bring the cast and professions across"
```

---

### Task 9: The vendored clue mix

**Files:**
- Create: `config/clue-mix.json` (generated once, from cbs2)
- Create: `shared/solver/mix.ts`
- Test: `shared/solver/mix.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `interface ClueMix { pred: Record<string, number>; feature: Record<string, number>; professionShapes: number[][] }`, `loadMix(data: unknown): ClueMix`, `mixFor3d(flat: ClueMix): ClueMix`.

- [ ] **Step 1: Produce the 2D mix from cbs2, once**

```bash
cd ~/code/cbsbd
npx tsx -e "import {archiveClueMix} from './shared/solver/corpus.ts'; \
  console.log(JSON.stringify(archiveClueMix(), null, 2))" > ~/code/cbsbd3d/config/clue-mix.json
```

Commit the file with a comment in `mix.ts` explaining that it cannot be regenerated in this repo — there is no scraped archive here — and that re-deriving it means going back to cbs2.

- [ ] **Step 2: Write the failing test**

```ts
import mixData from '../../config/clue-mix.json' with { type: 'json' };
import { loadMix, mixFor3d } from './mix';

const flat = loadMix(mixData);
const cube = mixFor3d(flat);

it('keeps the predicate shares verbatim', () => {
  expect(cube.pred).toEqual(flat.pred);
});

it('splits the 2D neighbour share between the two 3D kinds', () => {
  const half = (flat.feature['unit:neighbor'] ?? 0) / 2;
  expect(cube.feature['unit:hneighbor']).toBeCloseTo(half);
  expect(cube.feature['unit:vneighbor']).toBeCloseTo(half);
  expect(cube.feature['unit:neighbor']).toBeUndefined();
});

it('gives slice the mean of row and column', () => {
  const mean = ((flat.feature['unit:row'] ?? 0) + (flat.feature['unit:col'] ?? 0)) / 2;
  expect(cube.feature['unit:slice']).toBeCloseTo(mean);
});

it('borrows reach from between, and face and core from corner', () => {
  expect(cube.feature['unit:reach']).toBeCloseTo(flat.feature['unit:between'] ?? 0);
  expect(cube.feature['unit:face']).toBeCloseTo(flat.feature['unit:corner'] ?? 0);
  expect(cube.feature['unit:core']).toBeCloseTo(flat.feature['unit:corner'] ?? 0);
});

it('extends every direction key with a depth component', () => {
  for (const k of Object.keys(cube.feature)) {
    if (k.startsWith('dir:')) expect(k.split(',')).toHaveLength(3);
  }
  const twoD = ['0,-1', '0,1', '-1,0', '1,0'].map((d) => flat.feature[`dir:${d}`] ?? 0);
  const mean = twoD.reduce((a, b) => a + b, 0) / 4;
  expect(cube.feature['dir:0,0,1']).toBeCloseTo(mean);
  expect(cube.feature['dir:0,0,-1']).toBeCloseTo(mean);
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run shared/solver/mix.test.ts`
Expected: FAIL — `./mix` not found.

- [ ] **Step 4: Write `mix.ts`**

```ts
/**
 * The clue mix cannot be measured here. It comes from `archiveClueMix()` over
 * cbs2's scraped archive, committed as `config/clue-mix.json`, and is
 * translated to the cube's vocabulary below. Everything past the predicate
 * shares is an estimate: it exists to stop the candidate pool's own
 * combinatorial shape deciding the mix, not because anyone measured a cube.
 */
export function mixFor3d(flat: ClueMix): ClueMix {
  const f = { ...flat.feature };
  const take = (k: string) => f[k] ?? 0;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(f)) {
    if (k === 'unit:neighbor') {
      out['unit:hneighbor'] = v / 2;
      out['unit:vneighbor'] = v / 2;
    } else if (k.startsWith('dir:')) {
      out[`${k},0`] = v;
    } else {
      out[k] = v;
    }
  }
  out['unit:slice'] = (take('unit:row') + take('unit:col')) / 2;
  out['unit:reach'] = take('unit:between');
  out['unit:face'] = take('unit:corner');
  out['unit:core'] = take('unit:corner');
  const depth = (take('dir:0,-1') + take('dir:0,1') + take('dir:-1,0') + take('dir:1,0')) / 4;
  out['dir:0,0,1'] = depth;
  out['dir:0,0,-1'] = depth;
  return { pred: { ...flat.pred }, feature: out, professionShapes: flat.professionShapes.map((s) => [...s]) };
}
```

`loadMix` validates shape and throws `MixFormatError` on anything else, following `loadBands` in cbs2's `difficulty.ts`.

`ClueMix` is declared here, not in `corpus.ts` as it was in cbs2 — it no longer comes from an archive read, so it no longer belongs to one. `orderPool` and `GenerateInput` in Task 12 import it from `./mix`.

- [ ] **Step 5: Run and commit**

Run: `npx vitest run shared/solver/mix.test.ts`
Expected: PASS.

```bash
git add config/clue-mix.json shared/solver/mix.ts shared/solver/mix.test.ts
git commit -m "Vendor the clue mix and translate it to the cube"
```

---

### Task 10: Difficulty bands

**Files:**
- Create: `config/difficulty.json` (copied from cbs2)
- Create: `shared/solver/difficulty.ts` (fork of cbs2's)
- Test: `shared/solver/difficulty.test.ts` (fork, extended)

**Interfaces:**
- Consumes: `predicates.ts`.
- Produces: `Metrics`, `measure`, `Band`, `LabelBand`, `Bands`, `bandsFor(bands, size)`, `classify(bands, m)`, `gatesPass`, `loadBands`, `CALIBRATION_SIZE`, `ABSTRACT_PREDICATES`.

- [ ] **Step 1: Copy the bands and the module**

```bash
cp ~/code/cbsbd/config/difficulty.json ~/code/cbsbd3d/config/
cp ~/code/cbsbd/shared/solver/difficulty.ts ~/code/cbsbd/shared/solver/difficulty.test.ts \
   ~/code/cbsbd3d/shared/solver/
```

`buildBands` and `InsufficientSamplesError` stay: they are how the committed file was made, and deleting them makes the file unreproducible even in principle. Add a comment saying the file came from cbs2's human-labelled 4x5 archive and that nothing here can regenerate it.

- [ ] **Step 2: Write the failing test**

```ts
import bandsData from '../../config/difficulty.json' with { type: 'json' };
import { bandsFor, loadBands } from './difficulty';

const BANDS = bandsFor(loadBands(bandsData), 27);

it('refits the card-counting fields from twenty cards to twenty-seven', () => {
  const flat = loadBands(bandsData);
  expect(BANDS.Medium.clueCards.max).toBeGreaterThan(flat.Medium.clueCards.max);
  expect(BANDS.Medium.abstractShare).toEqual(flat.Medium.abstractShare);
});

it('gives Medium a criminal range that fits 27 cards', () => {
  expect(BANDS.Medium.criminals.min).toBeGreaterThan(0);
  expect(BANDS.Medium.criminals.max).toBeLessThan(27);
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run shared/solver/difficulty.test.ts`
Expected: FAIL on the two new cases; cbs2's ported cases pass.

- [ ] **Step 4: Fix the ported tests for 27 cards**

The ported suite's fixtures assume 20 cards. Re-point them at 27; where a test asserts an exact refitted number, recompute it rather than loosening the assertion.

- [ ] **Step 5: Run and commit**

Run: `npx vitest run shared/solver/difficulty.test.ts`
Expected: PASS.

```bash
git add config/difficulty.json shared/solver/difficulty.ts shared/solver/difficulty.test.ts
git commit -m "Vendor the difficulty bands and refit them to 27 cards"
```

---

### Task 11: The puzzle file format

**Files:**
- Create: `shared/puzzle.ts`
- Test: `shared/puzzle.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Person`, `HintStep`, `Puzzle`, `validatePuzzle(data: unknown): Puzzle`, `PuzzleValidationError`.

Fork cbs2's `shared/puzzle.ts` and cut what does not apply: no `VARIANTS`, no `ONE_OFFS`, no `Variant`, no `puzzleBillingOf`, no `width`/`height`.

```ts
export interface Puzzle {
  formatVersion: 1;
  id: string;            // 12 lowercase hex chars
  date: string;          // YYYY-MM-DD
  title: string;
  difficulty: string;    // whatever classify() said; descriptive, not aimed at
  initialReveals: number[];
  source: string;
  people: Person[];      // exactly 27, in index order
  hints?: HintStep[];
}
```

`title` is drawn from `TITLES` and `FLAVOUR` in `vocab.ts` by the same seeded rng that builds the puzzle, so it is reproducible from the filename like everything else. `source` is the literal `'generated'` — there is no other kind of puzzle here.

- [ ] **Step 1: Write the failing tests**

```ts
const valid = { /* a complete 27-person puzzle fixture */ };

it('accepts a well-formed cube', () => {
  expect(() => validatePuzzle(valid)).not.toThrow();
});

it('demands exactly 27 people', () => {
  expect(() => validatePuzzle({ ...valid, people: valid.people.slice(0, 26) }))
    .toThrow(/people length 26/);
});

it('rejects an out-of-range reveal', () => {
  expect(() => validatePuzzle({ ...valid, initialReveals: [27] })).toThrow(PuzzleValidationError);
});

it('rejects an unknown formatVersion', () => {
  expect(() => validatePuzzle({ ...valid, formatVersion: 2 })).toThrow(/formatVersion/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run shared/puzzle.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `shared/puzzle.ts`**

Port cbs2's `validatePuzzle` with `const count = 27` in place of `width * height`, and every width/height check removed.

- [ ] **Step 4: Run and confirm**

Run: `npx vitest run shared/puzzle.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/puzzle.ts shared/puzzle.test.ts
git commit -m "Define the cube puzzle file format"
```

---

### Task 12: Generation

**Files:**
- Create: `shared/solver/generate.ts` (fork of cbs2's)
- Test: `shared/solver/generate.test.ts` (fork, re-pointed)

**Interfaces:**
- Consumes: everything above.
- Produces: `makeRng(seed)`, `shuffled(rng, xs)`, `pickCriminals(rng, count)`, `orderPool`, `castOf(rng, professionShapes)`, `professionShapesFor`, `GenerateInput`, `GenerateResult`, `generatePuzzle(input)`, `GenerationError`.

`GenerateInput` loses `width`, `height` and `variant`; `labelOf` becomes required rather than optional, which is what makes generation unaimed by construction.

- [ ] **Step 1: Write the failing tests**

```ts
it('deals the cast alphabetically in address order', () => {
  const { puzzle } = generatePuzzle(input);
  const names = puzzle.people.map((p) => p.name);
  expect([...names].sort()).toEqual(names);
  expect(names[0][0] < names[26][0]).toBe(true);
});

it('draws criminals uniformly, with no inward bias', () => {
  const rng = makeRng(1);
  const counts = new Array(27).fill(0);
  for (let t = 0; t < 4000; t++) for (const i of pickCriminals(rng, 6)) counts[i]++;
  const core = counts[indexOfAddress('B2b')];
  const corner = counts[indexOfAddress('A1a')];
  expect(Math.abs(core - corner) / corner).toBeLessThan(0.15);
});

it('keeps whatever difficulty it generates', () => {
  const { puzzle, metrics } = generatePuzzle(input);
  expect(puzzle.difficulty).toBe(classify(BANDS, metrics));
});

it('is deterministic in its seed', () => {
  expect(generatePuzzle(input).puzzle).toEqual(generatePuzzle(input).puzzle);
});

it('is uniquely solvable', () => {
  const { puzzle } = generatePuzzle(input);
  const board = boardFor(puzzle);                        // from corpus.ts, Task 5
  const clues = parseClues(puzzle.people.map((p) => p.origHint));  // from clues.ts, Task 5
  expect(isUniquelySolvable(board, clues)).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run shared/solver/generate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Port `generate.ts`**

Changes from cbs2:

- Delete `pickCriminals`' inward bias. It exists to match the archive's 65.8% edge share, and 26 of 27 cube cells are on the outer shell, so the statistic is meaningless here. The body becomes `shuffled(rng, [...Array(27).keys()]).slice(0, count)`.
- `castOf` deals names by bucket as cbs2 does, then **sorts the dealt names** before assigning them to cards, so alphabetical order is address order. Professions are dealt after the sort and are not sorted.
- `labelOf` is required. Band rejection is gone; keep the reveal ceiling and abstraction target that `band` sets.
- Board size is fixed; delete `width`/`height` plumbing.

- [ ] **Step 4: Run and confirm**

Run: `npx vitest run shared/solver/generate.test.ts`
Expected: PASS. Note the wall-clock time of the generation cases — this is the first real measurement of the cost risk in the spec. If a single cube takes more than about 60 seconds, stop and report before continuing; the lever is gating the reach family out of `candidateUnits`.

- [ ] **Step 5: Commit**

```bash
git add shared/solver/generate.ts shared/solver/generate.test.ts
git commit -m "Generate a cube, unaimed"
```

---

### Task 13: The scripts

**Files:**
- Create: `scripts/generate.mts`, `scripts/manifest.mts`, `scripts/audit.mts`
- Test: `scripts/generate.test.mts`, `scripts/manifest.test.mts`

**Interfaces:**
- Consumes: `shared/solver/generate.ts`, `shared/puzzle.ts`, `config/*.json`.
- Produces: `seedFor(date: string): number`, `runGenerate(opts): Promise<{ written: string[] }>`, `regenerateManifest(dir): ManifestEntry[]`, `auditAll(dir): { checked: number; failures: string[] }`.

- [ ] **Step 1: Write the failing tests**

```ts
it('seeds from the date string alone', () => {
  expect(seedFor('2026-09-04')).toBe(seedFor('2026-09-04'));
  expect(seedFor('2026-09-04')).not.toBe(seedFor('2026-09-05'));
});

it('writes one file per missing date and skips existing ones', async () => {
  const dir = await mkdtemp();
  await runGenerate({ dir, dates: ['2026-09-04'] });
  const again = await runGenerate({ dir, dates: ['2026-09-04'] });
  expect(again.written).toEqual([]);
});

it('lists only date-shaped files in the manifest', async () => {
  await writeFile(join(dir, 'notes.json'), '{}');
  expect(regenerateManifest(dir).map((e) => e.date)).toEqual(['2026-09-04']);
});

it('re-derives a committed puzzle from its filename', async () => {
  const { failures } = await auditAll(dir);
  expect(failures).toEqual([]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run scripts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the scripts**

`generate.mts` computes the dates that need files — today through today+6, skipping any already on disk — and for each calls `generatePuzzle` with `seedFor(date)`, the refitted **Medium** band as `band`, `mixFor3d(loadMix(mixData))` as `mix`, and `labelOf: (m) => classify(BANDS, m)`. It writes `puzzles/YYYY-MM-DD.json` and then regenerates the manifest. `--force` redoes existing dates; a bare date argument does that one date.

`manifest.mts` walks `puzzles/` for `YYYY-MM-DD.json`, validates each, and writes `puzzles/index.json` as `{ puzzles: [{ date, id, difficulty }] }`, newest first.

`audit.mts` re-derives each committed puzzle from its own filename — same seed, same inputs — and compares the result to the file, then independently re-checks unique solvability and that every card's `paths` actually reach it. This is the only thing standing between a bad generator change and a shipped broken cube.

- [ ] **Step 4: Run the scripts for real**

Run: `npm run generate && npm run audit`
Expected: seven files in `puzzles/`, a manifest, and `audit` reporting 7 checked, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add scripts puzzles package.json
git commit -m "Generate, list and audit a week of cubes"
```

---

### Task 14: The nightly workflow

**Files:**
- Create: `.github/workflows/generate.yml`

**Interfaces:**
- Consumes: `npm run generate`, `npm run audit`.
- Produces: a committed puzzle file per day, keeping the archive seven days ahead.

- [ ] **Step 1: Write the workflow**

```yaml
name: generate
on:
  schedule:
    - cron: '17 3 * * *'
  workflow_dispatch:
permissions:
  contents: write
jobs:
  generate:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run generate
      - run: npm run audit
      - run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add puzzles
          git diff --cached --quiet || git commit -m "Generate puzzles through $(date -u -d '+6 days' +%F)"
          git push
```

- [ ] **Step 2: Run it by hand**

Push the branch, then trigger `workflow_dispatch` from the Actions tab.
Expected: green run; either a commit adding the newly-needed date, or no commit because the archive is already seven days ahead.

- [ ] **Step 3: Confirm the buffer holds**

Check that `puzzles/` contains today through today+6 after the run.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/generate.yml
git commit -m "Generate a week ahead, nightly"
```

---

## Done when

`npm test` is green, `npm run generate` writes a week of cubes, `npm run audit` re-derives all of them from their filenames with no failures, and the nightly workflow has run green once by hand. At that point the app plan has real files to read.
