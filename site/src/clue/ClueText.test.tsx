// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Person } from '../../../shared/puzzle';
import ClueText from './ClueText';

const person = (name: string, profession: string): Person => ({
  name, profession, gender: 'male', criminal: false, clue: null, origHint: null, paths: [],
});
const people = [person('banda', 'coder'), person('mira', 'chef'), person('ozan', 'pilot')];

// Mirrors today's real 4x5 puzzle grid (names from cluesbysam.com 2026-07-07).
const names20 = ['banda', 'celia', 'dana', 'eli', 'ghani', 'hazel', 'ivan', 'jerry', 'kay', 'logan',
  'max', 'nala', 'penny', 'quita', 'terry', 'umar', 'vince', 'wanda', 'xia', 'zane'];
const grid = names20.map((n) => person(n, 'coder'));

const renderClue = (clue: string, opts: { people?: Person[]; width?: number; selfIndex?: number } = {}) =>
  render(
    <ClueText clue={clue} people={opts.people ?? grid} width={opts.width ?? 4} selfIndex={opts.selfIndex} />,
  ).container.textContent;

describe('ClueText', () => {
  it('renders names capitalized and highlighted', () => {
    const { container } = render(
      <ClueText clue="Ask #NAME:1 or #NAMES:0 friend" people={people} width={3} />,
    );
    expect(container.textContent).toBe("Ask Mira or Banda's friend");
    const names = container.querySelectorAll('.clue-name');
    expect(names).toHaveLength(2);
    expect(names[0].textContent).toBe('Mira');
  });

  it('gives names ending in s a bare-apostrophe possessive', () => {
    const chris = [person('chris', 'chef'), person('mira', 'chef')];
    expect(renderClue('#NAMES:0 hat', { people: chris, width: 2 })).toBe("Chris' hat");
  });

  it('renders self-references with the right grammar (me/my/I/I am/and I)', () => {
    expect(renderClue('No innocents neighbor #NAME:1, says #NAMES:1 friend', { selfIndex: 1 })).toBe(
      'No innocents neighbor me, says my friend',
    );
    expect(renderClue('#NAME:1 is guilty', { selfIndex: 1 })).toBe('I am guilty');
    expect(renderClue('#NAME:1 has a hat', { selfIndex: 1 })).toBe('I have a hat');
    expect(renderClue('#NAME:1 sleeps', { selfIndex: 1 })).toBe('I sleeps');
    expect(renderClue('#NAME:0 and #NAME:1 are cousins', { selfIndex: 1 })).toBe('Banda and I are cousins');
    expect(renderClue('#NAME:1 and #NAME:0 are cousins', { selfIndex: 1 })).toBe('Banda and I are cousins');
  });

  it('renders professions and columns, pluralizing witch specially', () => {
    const { container } = render(
      <ClueText clue="The #PROF:coder in column #C:0, two #PROFS:witch" people={people} width={3} />,
    );
    expect(container.textContent).toBe('The coder in column A, two witches');
    expect(container.querySelector('.clue-prof')?.textContent).toBe('coder');
  });

  describe('#BETWEEN positional paraphrasing (ported from the real renderer)', () => {
    it('column segment touching the top edge: above <card below it>', () => {
      // pair(0,4) = A1..A2; card below is Kay (A3, index 8)
      expect(renderClue('There are no innocents #BETWEEN:pair(0,4) who neighbor #NAME:9', { selfIndex: 9 }))
        .toBe('There are no innocents above Kay who neighbor me');
      expect(renderClue('no innocents #BETWEEN:pair(0,4)', { selfIndex: 8 })).toBe('No innocents above me');
    });

    it('column segment touching the bottom edge: below <card above it>', () => {
      // pair(12,16) = A4..A5; card above is Kay (A3, index 8)
      expect(renderClue('one criminal #BETWEEN:pair(12,16)')).toBe('One criminal below Kay');
    });

    it('mid-column segment: in between <bounding cards>', () => {
      // pair(7,11) = D2..D3; bounded by Eli (D1, 3) and Umar (D4, 15)
      expect(renderClue('There is only one innocent #BETWEEN:pair(7,11)'))
        .toBe('There is only one innocent in between Eli and Umar');
      // self as a bounding card renders as me, placed last
      expect(renderClue('one innocent #BETWEEN:pair(7,11)', { selfIndex: 15 }))
        .toBe('One innocent in between Eli and me');
    });

    it('row segment touching the right edge: to the right of <card left of it>', () => {
      // pair(9,11) = B3..D3; card to the left is Kay (A3, 8)
      expect(renderClue('There are exactly 2 innocents #BETWEEN:pair(9,11)'))
        .toBe('There are exactly 2 innocents to the right of Kay');
    });

    it('row segment touching the left edge: to the left of <card right of it>', () => {
      // pair(4,6) = A2..C2; card to the right is Jerry (D2, 7)
      expect(renderClue('no criminals #BETWEEN:pair(4,6)')).toBe('No criminals to the left of Jerry');
    });

    it('full rows and full columns', () => {
      expect(renderClue('All innocents #BETWEEN:pair(0,3) are connected'))
        .toBe('All innocents in row 1 are connected');
      expect(renderClue('Both criminals #BETWEEN:pair(12,15) are connected'))
        .toBe('Both criminals in row 4 are connected');
      expect(renderClue('one criminal #BETWEEN:pair(1,17)')).toBe('One criminal in column B');
    });
  });

  it('rewrites "exactly 0" as "no" and capitalizes the clue', () => {
    expect(renderClue('there are exactly 0 criminals #BETWEEN:pair(0,3)'))
      .toBe('There are no criminals in row 1');
  });

  it('renders unknown tokens and out-of-range indices as plain text', () => {
    const { container } = render(<ClueText clue="#FFF and #NAME:99" people={people} width={3} />);
    expect(container.textContent).toBe('#FFF and #NAME:99');
  });
});
