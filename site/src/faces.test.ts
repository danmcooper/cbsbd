import { describe, expect, it } from 'vitest';
import { faceFor } from './faces';

const person = (profession: string, gender: string, face?: string | null) => ({
  profession,
  gender,
  face,
});

describe('faceFor', () => {
  it('maps cook, guard, cop, and painter with gender agreement', () => {
    expect(faceFor(person('cook', 'male'))).toBe('👨‍🍳');
    expect(faceFor(person('cook', 'female'))).toBe('👩‍🍳');
    expect(faceFor(person('guard', 'male'))).toBe('💂‍♂️');
    expect(faceFor(person('guard', 'female'))).toBe('💂‍♀️');
    expect(faceFor(person('cop', 'male'))).toBe('👮‍♂️');
    expect(faceFor(person('cop', 'female'))).toBe('👮‍♀️');
    expect(faceFor(person('painter', 'male'))).toBe('👨‍🎨');
    expect(faceFor(person('painter', 'female'))).toBe('👩‍🎨');
  });

  it('prefers the face scraped into the puzzle file over the table', () => {
    expect(faceFor(person('cook', 'male', '🦖'))).toBe('🦖');
    expect(faceFor(person('plumber', 'male', '🪠'))).toBe('🪠');
  });

  it('falls back to the real renderer default for unknown professions', () => {
    expect(faceFor(person('plumber', 'male'))).toBe('😬');
    expect(faceFor(person('plumber', 'male', null))).toBe('😬');
  });
});
