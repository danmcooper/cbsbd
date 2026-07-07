import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ExtractError,
  extractMetadata,
  extractPeopleArray,
  findBundleUrl,
  normalizePuzzle,
} from './extract-core.mts';

const html = readFileSync(new URL('./fixtures/page.html', import.meta.url), 'utf8');
const bundle = readFileSync(new URL('./fixtures/bundle-index-abc123.js', import.meta.url), 'utf8');

describe('findBundleUrl', () => {
  it('resolves the module script relative to the page URL', () => {
    expect(findBundleUrl(html, 'https://cluesbysam.com/')).toBe(
      'https://cluesbysam.com/assets/index-abc123.js',
    );
  });

  it('resolves relative to archive-page URLs too', () => {
    expect(findBundleUrl(html, 'https://cluesbysam.com/s/play?puzzleId=a6f09e2713b2')).toBe(
      'https://cluesbysam.com/s/assets/index-abc123.js',
    );
  });

  it('throws a bundle-discovery ExtractError when no matching script exists', () => {
    expect(() => findBundleUrl('<html></html>', 'https://x.test/')).toThrowError(ExtractError);
    expect(() => findBundleUrl('<html></html>', 'https://x.test/')).toThrow(/\[bundle-discovery\]/);
  });
});

describe('extractPeopleArray', () => {
  it('extracts and evaluates the people array', () => {
    const people = extractPeopleArray(bundle) as Record<string, unknown>[];
    expect(people).toHaveLength(4);
    expect(people[0]).toMatchObject({ criminal: false, name: 'banda', profession: 'coder' });
    expect(people[1]).toMatchObject({ criminal: true, name: 'mira' });
    expect(people[2].paths).toEqual([[0, 1], [3]]);
  });

  it('bracket-matches through strings containing brackets', () => {
    const tricky = 'x=[{criminal:!1,profession:"a",name:"n",gender:"m",hint:"weird ] [ text",paths:[]}];';
    const people = extractPeopleArray(tricky) as Record<string, unknown>[];
    expect(people).toHaveLength(1);
    expect(people[0].hint).toBe('weird ] [ text');
  });

  it('throws array-parse when the signature is missing', () => {
    expect(() => extractPeopleArray('var x=1;')).toThrow(/\[array-parse\]/);
  });

  it('throws array-parse on unbalanced brackets', () => {
    expect(() => extractPeopleArray('x=[{criminal:!1,')).toThrow(/\[array-parse\]/);
  });
});

describe('extractMetadata', () => {
  it('extracts width/height/difficulty/title from constants before the array', () => {
    const meta = extractMetadata(bundle);
    expect(meta).toMatchObject({
      width: 2,
      height: 2,
      difficulty: 'Easy',
      title: 'A tiny test mystery',
    });
  });

  it('extracts date, puzzleId (adjacent to /log constant), and initial reveals', () => {
    const meta = extractMetadata(bundle);
    expect(meta.date).toBe('2026-07-07');
    expect(meta.id).toBe('a6f09e2713b2');
    expect(meta.initialReveals).toEqual([0]);
  });

  it('supports inline initial_reveals arrays', () => {
    const inline = bundle.replace('initial_reveals:fv', 'initial_reveals:[1,2]');
    expect(extractMetadata(inline).initialReveals).toEqual([1, 2]);
  });

  it('throws metadata-parse naming the missing piece', () => {
    expect(() => extractMetadata('var x=[{criminal:!1}];')).toThrow(/\[metadata-parse\]/);
    expect(() => extractMetadata(bundle.replace('"2026-07-07"', '"nope"'))).toThrow(/date/);
    expect(() => extractMetadata(bundle.replace('a6f09e2713b2', 'ZZZ'))).toThrow(/puzzleId/);
  });
});

describe('normalizePuzzle', () => {
  it('produces a valid Puzzle from the fixture bundle', () => {
    const puzzle = normalizePuzzle(extractMetadata(bundle), extractPeopleArray(bundle));
    expect(puzzle.formatVersion).toBe(1);
    expect(puzzle.id).toBe('a6f09e2713b2');
    expect(puzzle.source).toBe('cluesbysam.com');
    expect(puzzle.people).toHaveLength(4);
    // hint:"" and orig_hint map to clue/origHint with empty→null
    expect(puzzle.people[0].clue).toBeNull();
    expect(puzzle.people[0].origHint).toBe('number_of_traits_in_unit(unit(row,0),criminal,1)');
    expect(puzzle.people[1].clue).toBe('The #PROF:chef sits beside #NAME:0');
    expect(puzzle.people[2].paths).toEqual([[0, 1], [3]]);
  });

  it('treats missing paths as null and rejects invalid results as validation errors', () => {
    const meta = extractMetadata(bundle);
    const people = extractPeopleArray(bundle).map((p) => ({ ...(p as object), paths: undefined }));
    const puzzle = normalizePuzzle(meta, people);
    expect(puzzle.people[0].paths).toBeNull();
    expect(() => normalizePuzzle(meta, people.slice(0, 2))).toThrow(/\[validation\]/);
  });
});
