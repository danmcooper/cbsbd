import { describe, expect, it } from 'vitest';
import { type Shape } from './enumerate';
import { makeGrid } from './grid';
import { parseHint } from './hint';
import { entailedByKnown, readingReplay } from './reading';
import { type Clues } from './solve';

const shape: Shape = {
  grid: makeGrid(4, 5),
  professions: Array.from({ length: 20 }, () => 'cook'),
};
// Criminals at 0 and 1 only: row 1 is criminal, criminal, innocent, innocent.
const truth = Array.from({ length: 20 }, (_, i) => i < 2);
const row1 = [0, 1, 2, 3];

function clues(entries: Record<number, string>): Clues {
  const out: Clues = Array.from({ length: 20 }, () => null);
  for (const [i, s] of Object.entries(entries)) out[Number(i)] = parseHint(s);
  return out;
}

describe('entailedByKnown', () => {
  const twoInRow1 = parseHint('number_of_traits_in_unit(unit(row,1),criminal,2)');

  it('is true once every card the clue reads is face up', () => {
    expect(entailedByKnown(shape, twoInRow1, truth, row1)).toBe(true);
  });

  it('is false while a card the clue reads could still go either way', () => {
    expect(entailedByKnown(shape, twoInRow1, truth, [0, 1, 2])).toBe(false);
  });

  it('is true when the known cards settle it without covering it', () => {
    const atLeastOne = parseHint('min_number_of_traits_in_unit(unit(row,1),criminal,1)');
    expect(entailedByKnown(shape, atLeastOne, truth, [0])).toBe(true);
  });
});

describe('readingReplay', () => {
  it('reads clues as their cards come up and credits each with what it opened', () => {
    // Card 4's clue, readable from the start, turns over cards 0 and 1; card 0's,
    // read once it is up, clears the rest of row 2.
    const c = clues({
      4: 'number_of_traits_in_unit(unit(between,pair(0,1)),criminal,2)',
      0: 'number_of_traits_in_unit(unit(row,2),criminal,0)',
    });
    const reads = readingReplay(shape, c, truth, [4]);
    expect(reads.map((r) => r.host)).toEqual([4, 0]);
    expect(reads[0].gain).toEqual([0, 1]);
    expect(reads[1].gain).toEqual([5, 6, 7]);
    expect(reads.every((r) => !r.dead)).toBe(true);
  });

  it('traces a clue that opens nothing to the later clue that needs it', () => {
    // "Exactly 2 criminals in row 1" opens nothing alone; "no criminals among
    // cards 2 and 3" alone opens 2 and 3; together they also place 0 and 1.
    const c = clues({
      4: 'number_of_traits_in_unit(unit(row,1),criminal,2)',
      5: 'number_of_traits_in_unit(unit(between,pair(2,3)),criminal,0)',
    });
    const reads = readingReplay(shape, c, truth, [4, 5]);
    expect(reads.map((r) => [r.host, r.gain])).toEqual([
      [4, []],
      [5, [0, 1, 2, 3]],
    ]);
    expect(reads[0].feeds).toBe(5);
    expect(reads[1].feeds).toBeUndefined();
  });

  it('marks a clue that opens nothing and that nothing needs', () => {
    const c = clues({
      4: 'number_of_traits_in_unit(unit(row,1),criminal,2)',
      5: 'number_of_traits_in_unit(unit(row,3),criminal,0)',
    });
    const reads = readingReplay(shape, c, truth, [4, 5]);
    expect(reads[0].gain).toEqual([]);
    expect(reads[0].feeds).toBeNull();
  });

  it('flags a clue the board already settled when it is read', () => {
    const c = clues({
      4: 'number_of_traits_in_unit(unit(between,pair(0,3)),criminal,2)',
      0: 'number_of_traits_in_unit(unit(between,pair(0,1)),criminal,2)',
    });
    // Card 4's clue alone does not place the criminals; open row 1 by hand to
    // reach card 0, whose clue then talks only about cards already face up.
    const reads = readingReplay(shape, c, truth, [4, 0, 1, 2, 3]);
    const zero = reads.find((r) => r.host === 0);
    expect(zero?.dead).toBe(true);
    expect(zero?.gain).toEqual([]);
  });
});
