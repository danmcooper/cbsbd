import type { Puzzle } from '../../../shared/puzzle';

export function isDeducible(puzzle: Puzzle, flipped: number[], index: number): boolean {
  const paths = puzzle.people[index].paths;
  if (paths === null) return true;
  return paths.some((path) => path.every((i) => flipped.includes(i)));
}
