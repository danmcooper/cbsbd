// Measure `MixCorrection`: how much more of each kind of clue the candidate pool
// has to offer for what survives `buildChain` to come out in the archive's
// proportions. Writes config/mix-correction.json, which generation reads.
//
// Each round generates the same sample of puzzles under the current correction,
// counts the predicates and traits that came out, and moves each factor part of
// the way toward target/observed. Rerun after changing what `buildChain`
// accepts; the sample is small, so the factors are only good to a few percent.
//
//   npx tsx scripts/calibrate-mix.mts [rounds=4] [puzzles per round=60]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { type MixCorrection, archiveClueMix, loadMixCorrection } from '../shared/solver/corpus.ts';
import { bandsFor, classify, loadBands } from '../shared/solver/difficulty.ts';
import { generatePuzzle } from '../shared/solver/generate.ts';
import { parseHint } from '../shared/solver/hint.ts';
import { seedForDate, unionCriminals } from './generate.mts';

const rounds = Number(process.argv[2] ?? 4);
const perRound = Number(process.argv[3] ?? 60);
// The boards Dan puzzles are mostly drawn on, without the slow 6x6 and 5x6: the
// pass rates being corrected for move with board size, but not by much.
const BOARDS = [
  { width: 4, height: 5 },
  { width: 5, height: 5 },
  { width: 4, height: 4 },
  { width: 3, height: 4 },
];
// Partial steps, so one noisy round cannot throw a factor across the target.
const STEP = 0.8;
const CLAMP = { min: 0.2, max: 6 };
const OUT = path.join(process.cwd(), 'config', 'mix-correction.json');

const bands = loadBands(JSON.parse(readFileSync(path.join('config', 'difficulty.json'), 'utf8')));
const criminals = unionCriminals(bands);
const mix = archiveClueMix();
const labels = Object.keys(bands);
let correction: MixCorrection = loadMixCorrection();

function sample(c: MixCorrection) {
  const pred = new Map<string, number>();
  const trait = new Map<string, number>();
  let clues = 0;
  let traits = 0;
  for (let i = 0; i < perRound; i++) {
    const board = BOARDS[i % BOARDS.length];
    const aimed = labels[i % labels.length];
    let puzzle;
    try {
      ({ puzzle } = generatePuzzle({
        date: '2026-01-01',
        difficulty: aimed,
        band: { ...bands[aimed], criminals },
        seed: seedForDate(`calibrate-${i}`),
        mix,
        correction: c,
        ...board,
        labelOf: (m) => classify(bandsFor(bands, board.width * board.height), m),
      }));
    } catch {
      continue;
    }
    for (const person of puzzle.people) {
      if (!person.origHint) continue;
      const hint = parseHint(person.origHint);
      pred.set(hint.pred, (pred.get(hint.pred) ?? 0) + 1);
      clues++;
      for (const a of hint.args) {
        if (a.t !== 'trait') continue;
        trait.set(a.trait, (trait.get(a.trait) ?? 0) + 1);
        traits++;
      }
    }
  }
  return { pred, trait, clues, traits };
}

/** One factor moved toward target/observed. A pseudo-count keeps a kind seen
 * zero or one times from asking for an unbounded correction. */
function step(factor: number, target: number, seen: number, total: number): number {
  const ratio = (target * total + 1) / (seen + 1);
  return Math.min(CLAMP.max, Math.max(CLAMP.min, factor * ratio ** STEP));
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;

for (let r = 1; r <= rounds; r++) {
  const t0 = Date.now();
  const got = sample(correction);
  let tv = 0;
  for (const k of new Set([...Object.keys(mix.pred), ...got.pred.keys()])) {
    tv += Math.abs((got.pred.get(k) ?? 0) / got.clues - (mix.pred[k] ?? 0)) / 2;
  }
  const crim = (got.trait.get('criminal') ?? 0) / got.traits;
  console.log(
    `round ${r}: ${got.clues} clues in ${((Date.now() - t0) / 1000).toFixed(0)}s — ` +
      `predicate mismatch ${(100 * tv).toFixed(1)}%, criminal share ${(100 * crim).toFixed(1)}% ` +
      `(target ${(100 * (mix.trait.criminal ?? 0)).toFixed(1)}%)`,
  );
  const pred: Record<string, number> = {};
  for (const k of Object.keys(mix.pred).sort()) {
    if (mix.pred[k] === 0) continue;
    pred[k] = round3(step(correction.pred[k] ?? 1, mix.pred[k], got.pred.get(k) ?? 0, got.clues));
  }
  const trait: Record<string, number> = {};
  for (const k of Object.keys(mix.trait).sort()) {
    trait[k] = round3(step(correction.trait[k] ?? 1, mix.trait[k], got.trait.get(k) ?? 0, got.traits));
  }
  correction = { pred, trait };
  writeFileSync(OUT, JSON.stringify(correction, null, 2) + '\n');
}
console.log(`wrote ${OUT}`);
