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
    const { container } = render(<ClueText clue="Ask #NAME:1 or #NAMES:0 friend" people={people} />);
    expect(container.textContent).toBe("Ask Mira or Banda's friend");
    const names = container.querySelectorAll('.clue-name');
    expect(names).toHaveLength(2);
    expect(names[0].textContent).toBe('Mira');
  });

  it('renders professions, columns, and between-pairs', () => {
    const { container } = render(
      <ClueText clue="The #PROF:coder in #C:0, #PROFS:chef #BETWEEN:pair(0,2)" people={people} />,
    );
    expect(container.textContent).toBe('The coder in column A, chefs between Banda and Ozan');
    expect(container.querySelector('.clue-prof')?.textContent).toBe('coder');
  });

  it('renders unknown tokens and out-of-range indices as plain text', () => {
    const { container } = render(<ClueText clue="#FFF and #NAME:99" people={people} />);
    expect(container.textContent).toBe('#FFF and #NAME:99');
  });
});
