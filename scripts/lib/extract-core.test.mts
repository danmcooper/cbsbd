import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ExtractError, extractPeopleArray, findBundleUrl } from './extract-core.mts';

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
