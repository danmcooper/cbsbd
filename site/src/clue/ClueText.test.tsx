// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Person } from '../../../shared/puzzle';
import ClueText from './ClueText';

const person = (name: string, profession: string): Person => ({
  name, profession, gender: 'male', criminal: false, clue: null, origHint: null, paths: [],
});
const people = [person('banda', 'coder'), person('mira', 'chef'), person('ozan', 'pilot')];

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

  it('renders self-references as me/my', () => {
    const { container } = render(
      <ClueText clue="No innocents neighbor #NAME:1, says #NAMES:1 friend" people={people} width={3} selfIndex={1} />,
    );
    expect(container.textContent).toBe('No innocents neighbor me, says my friend');
  });

  it('renders professions and columns', () => {
    const { container } = render(
      <ClueText clue="The #PROF:coder in column #C:0, two #PROFS:chef" people={people} width={3} />,
    );
    expect(container.textContent).toBe('The coder in column A, two chefs');
    expect(container.querySelector('.clue-prof')?.textContent).toBe('coder');
  });

  it('renders between-pairs as inclusive grid-coordinate ranges', () => {
    // width 4: index 0 = A1, index 4 = A2, index 7 = D2, index 11 = D3
    const wide = [...Array(12)].map((_, i) => person(`p${i}`, 'coder'));
    const { container } = render(
      <ClueText clue="There is only one innocent #BETWEEN:pair(7,11)" people={wide} width={4} />,
    );
    expect(container.textContent).toBe('There is only one innocent in D2–D3');
    const { container: c2 } = render(
      <ClueText clue="no innocents #BETWEEN:pair(0,4) here" people={wide} width={4} />,
    );
    expect(c2.textContent).toBe('no innocents in A1–A2 here');
  });

  it('renders unknown tokens and out-of-range indices as plain text', () => {
    const { container } = render(<ClueText clue="#FFF and #NAME:99" people={people} width={3} />);
    expect(container.textContent).toBe('#FFF and #NAME:99');
  });
});
