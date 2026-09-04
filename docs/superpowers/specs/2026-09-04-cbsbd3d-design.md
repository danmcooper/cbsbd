# cbsbd3d — a Clues by Sam deduction game on a 3×3×3 cube

Date: 2026-09-04
Status: design approved, spec awaiting review
Repo: new — `cbsbd3d`. This document lives in `cbsbd` because that is the only
repo that exists today; it moves with the code.

## What it is

27 suspects stand in a see-through cube. Each is either a criminal or innocent.
You accuse suspects one at a time; a correct accusation flips them, revealing
the clue they were carrying, and the clues let you deduce the rest. One puzzle a
day, an archive behind it, no backfill — the archive begins on launch day.

The 2D game this repo already archives and generates for (`cbs2`) supplies the
rules, the solver and the pipeline. cbsbd3d forks all three. What is new is the
third axis and the renderer.

## Approach

Fork `shared/solver/` into the new repo and replace its geometry. `grid.ts` is
about sixty lines and `sat.ts`, `cardinality.ts`, `encode.ts`, `solve.ts` and
`difficulty.ts` never mention a coordinate — they work on member index lists —
so the cube reaches most of the solver through one new module.

Rejected: a clean-room 3D solver (rebuilds SAT with clause learning, candidate
generation and difficulty calibration, and abandons the corpus fidelity tests
that keep clue wording honest, to replace sixty lines of geometry); and
renderer-first against hand-authored puzzles (risks designing clues the
generator cannot produce, and the generator is the risky half).

The generator writes exactly the JSON the renderer consumes, so the renderer
stays live from the first generated cube.

## Geometry and addressing

A cell is `(x, y, z)` with flat index `i = z*9 + y*3 + x`.

| Axis | Range | Rendered | Direction |
| --- | --- | --- | --- |
| `x` | 0–2 | `A` `B` `C` | left to right |
| `y` | 0–2 | `1` `2` `3` | top to bottom |
| `z` | 0–2 | `a` `b` `c` | front to back |

An address is column letter, row digit, depth letter: `A1a` near top-left,
`B2b` the core, `C3c` far bottom-right. Columns and rows keep the 2D game's
convention; depth is lower case so an address never reads ambiguously. Every
cell wears its address, small, in its top-left corner.

Index order runs left→right, then top→bottom, then front→back, and the cast is
dealt in that order alphabetically: `ada` at A1a through `zola` at C3c. A
suspect's initial letter therefore tells you where they stand.

### Units

`lattice.ts` replaces `grid.ts` and precomputes every member list once per
board:

- **Slabs** — nine units of nine cells: rows 1–3, columns A–C, slices a–c.
- **Reach**, anchored on a card and a direction — `above` is every cell in the
  rows above that card, and likewise `below`, `left`, `right`, `in front`,
  `behind`. `Dir` is one of the six unit vectors. A reach holds 18, 9 or 0
  cells depending on where its anchor sits; an empty reach is never offered as
  a clue unit. Alongside each sits the single-step `directly above` and
  friends, which is all the 2D game ever had.
- **Neighbours**, two kinds, anchored on a card — *horizontal*: the face
  neighbours sharing its row, up to 4 (left, right, in front, behind);
  *vertical*: the 1–2 directly over or under. No diagonals. This is a
  deliberate divergence: 2D `neighbors()` returns all 8 surrounding cells.
- **Between** — the inclusive run between two cells sharing two coordinates, so
  axis-aligned only, as in 2D.
- **Position** — the cube's shape gives four groups covering every cell exactly
  once: 8 **corners**, 12 **edges**, 6 **face centres**, 1 **core**.
- **Profession** — unchanged from 2D: every card of a named profession.

`adjacent(i, j)` means the two cells share a face: the union of the two
neighbour kinds. The four predicates that use adjacency as a relation rather
than as a unit — `max_number_of_traits_in_neighbors_in_unit`,
`only_one_person_in_unit_has_exactly_n_trait_neighbors`,
`both_traits_are_neighbors_in_unit`, `all_traits_are_neighbors_in_unit` — use
`adjacent` and render as "are neighbours". Only the unit kinds are split
horizontal/vertical, because only those are named in clue text.

## Clue vocabulary

The hint AST survives. All 29 predicates in `hint.ts` operate on units, so
`number_of_traits_in_unit`, `has_most_traits`, `units_share_n_traits` and the
rest need no change. Three things move.

**Unit kinds.** `'row' | 'col' | 'neighbor' | 'between' | 'profession' | 'edge'
| 'corner'` becomes `'row' | 'col' | 'slice' | 'hneighbor' | 'vneighbor' |
'reach' | 'between' | 'profession' | 'corner' | 'edge' | 'face' | 'core'`.
`slice` takes an `n` like row and col. `neighbor` splits in two, both still
anchored on a card index. `reach` is `{ kind: 'reach'; i: number; dir: Dir }`.
The four position groups take no argument.

**Directions gain an axis.** The `*_in_dir` predicates carry `(dx, dy)` today
and `(dx, dy, dz)` in the cube. Only the six unit vectors are ever generated,
matching the six single-step phrasings. This is the only arity change in the
predicate table.

**Words.** `render.ts` learns `in slice b`; `directly behind them` and
`directly in front of them`; the wide reach phrasings `behind them`, `in front
of them`, `above them`, `below them`, `to the left of them`, `to the right of
them`; `a horizontal neighbour` and `a vertical neighbour`; and `a corner`, `an
edge`, `a face centre`, `the core`.

Clues stay third person about named suspects — "2 criminals are behind cleo" —
because a clue often talks about someone other than its carrier, and the corpus
fidelity tests are written against that phrasing.

The kind-quantified predicates (`only_one_unit_has_exactly_n_traits`,
`all_units_have_at_least_n_traits`) now range over three rows, three columns or
three slices: a cleaner three-way comparison than the 2D game's uneven row and
column counts.

## Generation

One file per date, `puzzles/YYYY-MM-DD.json`, with `puzzles/index.json` as the
manifest. No scraping, so no variants and no filename suffixes. Generation is
seeded from the date string, so any file can be rebuilt from its own name;
`scripts/audit.mts` re-derives every committed puzzle and checks it, following
`audit-dan.mts`.

Building one cube:

1. Deal the cast — one name per initial letter from shuffled buckets, then
   sorted, so alphabetical order is address order.
2. Deal professions with `professionsFor` refitted to 27 cards, landing near
   two or three cards each.
3. Sample a criminal assignment. The count is drawn from the refitted
   `criminals` range, spanning all bands rather than one. The 2D
   inward bias is **dropped**: it exists to match the source archive's 65.8%
   edge share, and on a cube 26 of 27 cells are on the outer shell, so the
   statistic has no meaning here. Draw uniformly, and revisit only if generated
   cubes read badly.
4. Generate candidate hints for every card.
5. SAT-check that the board has a unique solution; prune to a minimal set that
   still forces it.
6. Compute each card's deduction path, for the flip-enforcement rule.
7. Pick the initial reveals.

**Generation is unaimed.** There is no target band and no weekday schedule.
Each date generates one cube, `classify` reads the difficulty off the result
using bands refitted from 20 cards to 27 by `bandsFor`, and that label is
recorded and shown. Nothing is discarded or retried for missing a target, which
also removes the 2D generator's most expensive loop. This is `generatePuzzle`'s
`labelOf` hook, which already exists and is already how 2D generation is driven
in practice.

`band` still *shapes* an attempt even when it no longer rejects one — it sets
the criminal-count range, the reveal ceiling and the abstraction target — so
every attempt is shaped by the refitted **Medium** band, and the label is
whatever `classify` says came out.

The label is therefore descriptive, not prescriptive — and worth reading
loosely. The 2D bands are fitted from human ratings on the source site's 4×5
archive; there is no rated 3D archive and never will be, so a refitted label on
a cube is an estimate. It costs nothing to display and nothing to be wrong.

**Clue mix is vendored.** `orderPool` needs a `ClueMix` or the candidate
pool's own combinatorial shape decides the clue proportions, which is how 2D's
generated puzzles once came out three times heavier on `between` than any real
one. That mix comes from `archiveClueMix()`, a read of the scraped archive —
which cbsbd3d does not have and never will. So the mix is computed once in
`cbs2`, committed to cbsbd3d as `config/clue-mix.json`, and translated to the
cube's vocabulary by `mixFor3d`:

- `pred` shares carry over verbatim: the 29 predicates are unchanged.
- `dir:dx,dy` becomes `dir:dx,dy,0`; the two new depth directions each take the
  mean of the four 2D directions.
- `unit:neighbor`'s share splits evenly between `unit:hneighbor` and
  `unit:vneighbor`.
- `unit:slice` takes the mean of `unit:row` and `unit:col`.
- `unit:reach` takes `unit:between`'s share — both are wide multi-cell units.
- `unit:face` and `unit:core` each take `unit:corner`'s share.
- `professionShapes` are refitted to 27 cards by `professionShapesFor`.

Every number past the first bullet is an estimate. They exist to stop the pool
running away with the mix, not because anyone measured them on a cube.

**Cost is the open risk.** 27 cards is fewer than the 6×6 that takes about six
seconds, but the unit space is much larger: nine slabs, six reach directions on
each of 27 cards, two neighbour kinds. Candidate generation scales with units,
not cells. Measure on day one. If it is bad, the lever is the one the 2D repo
already has — gate vocabulary tiers by board, starting with reach, the
expensive family.

A nightly GitHub Action generates and commits so the archive always runs seven
days ahead. A failed or slow run then costs nothing visible, which matters more
here than in the 2D repo, where a scraped puzzle is always available.

## The app

Static site, Vite and TypeScript, GitHub Pages under a UUID base path read from
`config/site.json`. No server and no API: the app fetches the manifest and one
dated file.

**Scene.** three.js. 27 cells in a see-through lattice, each an extruded Twemoji
SVG carrying its profession.

- Unsolved: a small head riding above a large fitted name and profession.
- Solved: the face vanishes, name and profession move to the top, everything
  turns red (criminal) or green (innocent), and the clue fills the space the
  face left, on a solid black bar behind the clue only.
- Red and green are identical in every dimension. The verdict is colour alone.
- Every clue on the board renders at one shared size, the tightest fit across
  all of them, so a wordy clue never reads as a smaller one.
- Label fill is per slice: three shades of one green, lightest at the front.
- All text shares the faces' depth plane.
- Three DOM slice switches in a row at the bottom, sized 32/23/16px near to far,
  left to right, each an independent on/off. A hidden slice is removed, not
  faded.

**Camera.** Opens square-on with only the front slice visible, viewer at mid
height, framed from fov and aspect allowing for the rotated diagonal so nothing
clips mid-turn. Drag sideways rotates about y. Drag vertically slides the viewer
up and down at constant distance — no tilt. Wheel or pinch zooms.

**Shipping changes from the mockup.** three.js comes from npm and is bundled,
not from a CDN importmap; the Twemoji SVGs and the TextGeometry font are
vendored. Geometry is built once per puzzle and reused.

**State.** The 2D reducer, unchanged in substance: tap a suspect, choose
criminal or innocent; correct and deducible flips them and reveals their clue;
wrong is a recorded mistake and no flip; a non-deducible card cannot be guessed
at all. Per-puzzle localStorage keyed by puzzle id holds flips, mistakes and
elapsed time.

WebGL is required. Without it the app says so rather than degrading.

## Testing

- `lattice.ts` unit tests: addresses round-trip, slab membership, reach counts
  (18, 9 or 0, and an empty one is never offered), neighbour counts (corner A1a: 2 horizontal, 1 vertical; core B2b:
  4 and 2), position groups partition all 27 cells.
- Solver tests port from 2D, re-pointed at the cube.
- `render.ts` tests cover every new word.
- A generation test that builds one cube at the shipped size and checks it is
  sound, matching `npm run test:generate`.
- `scripts/audit.mts` re-derives every committed puzzle from its filename.
- Reducer tests: flip, mistake, enforcement, persistence. Component tests stay
  light; logic lives in the reducer.

## Out of scope

Backfilled archive dates. Aiming generation at a difficulty, and any weekday
schedule. Practice or endless mode. Cube sizes other than
3×3×3. Variants. A non-WebGL fallback. Sharing the solver with the 2D repo.
