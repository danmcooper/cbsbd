// How much does each clue tell the player, at the moment the player can read it?
//
// Replays a puzzle the way it is played: a clue becomes readable when its card
// is flipped, clues are read one at a time in the order their cards came up,
// and after each one every card the clues read so far force is flipped. For
// each clue this records
//   gain  — cards newly forced by reading it (with everything read before it)
//   solo  — cards it forces on its own, given only the known cards
//   dead  — whether the known cards already settled it: true of every way of
//           filling in the rest, so it says nothing the board does not
//
// `npx tsx scripts/reveal-stats.mts` compares the real archive with the Dan
// puzzles; add `--each` to list every puzzle, `--file <name>` for one in detail.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { type Puzzle } from '../shared/puzzle.ts';
import { type Shape } from '../shared/solver/enumerate.ts';
import { makeGrid } from '../shared/solver/grid.ts';
import { readingReplay } from '../shared/solver/reading.ts';
import { parseClues } from '../shared/solver/solve.ts';

const dir = path.join(process.cwd(), 'puzzles');
const args = process.argv.slice(2);
const each = args.includes('--each');
const only = args.includes('--file') ? args[args.indexOf('--file') + 1] : null;

function replayFile(file: string) {
  const puzzle = JSON.parse(readFileSync(path.join(dir, file), 'utf8')) as Puzzle;
  const shape: Shape = {
    grid: makeGrid(puzzle.width, puzzle.height),
    professions: puzzle.people.map((p) => p.profession),
  };
  const clues = parseClues(puzzle.people.map((p) => p.origHint));
  const truth = puzzle.people.map((p) => p.criminal);
  return { puzzle, reads: readingReplay(shape, clues, truth, puzzle.initialReveals) };
}

function histogram(xs: number[]): string {
  const h = new Map<number, number>();
  for (const x of xs) h.set(Math.min(x, 6), (h.get(Math.min(x, 6)) ?? 0) + 1);
  return [...h]
    .sort((a, b) => a[0] - b[0])
    .map(([k, n]) => `${k === 6 ? '6+' : k}:${n} (${((100 * n) / xs.length).toFixed(1)}%)`)
    .join('  ');
}

if (only) {
  const { puzzle, reads } = replayFile(only);
  for (const r of reads) {
    console.log(
      `${puzzle.people[r.host].name.padEnd(8)} gain=${r.gain.length} solo=${r.solo.length}` +
        `${r.dead ? ' DEAD' : ''}  ${puzzle.people[r.host].clue}`,
    );
  }
  process.exit(0);
}

const groups: Record<string, string[]> = {
  real: readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort(),
  dan: readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}-dan\.json$/.test(f)).sort(),
};

for (const [name, files] of Object.entries(groups)) {
  const gains: number[] = [];
  const solos: number[] = [];
  let dead = 0;
  let entailed = 0;
  let clues = 0;
  const worst: { file: string; gain: number; solo: number }[] = [];
  for (const file of files) {
    const { reads } = replayFile(file);
    const g = reads.map((r) => r.gain.length);
    const s = reads.map((r) => r.solo.length);
    gains.push(...g);
    solos.push(...s);
    dead += reads.filter((r) => r.gain.length === 0).length;
    entailed += reads.filter((r) => r.dead).length;
    clues += reads.length;
    worst.push({ file, gain: Math.max(...g), solo: Math.max(...s) });
    if (each) {
      console.log(
        `${file} max gain=${Math.max(...g)} max solo=${Math.max(...s)} ` +
          `gain0=${reads.filter((r) => r.gain.length === 0).length}/${reads.length} ` +
          `dead=${reads.filter((r) => r.dead).length}`,
      );
    }
  }
  console.log(`\n${name}: ${files.length} puzzles, ${clues} clues, ${dead} reveal nothing when read, ${entailed} already settled by the board`);
  console.log(`  gain per clue: ${histogram(gains)}`);
  console.log(`  solo per clue: ${histogram(solos)}`);
  console.log(`  puzzle max gain: ${histogram(worst.map((w) => w.gain))}`);
  console.log(`  puzzle max solo: ${histogram(worst.map((w) => w.solo))}`);
}
