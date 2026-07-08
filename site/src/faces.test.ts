import { describe, expect, it } from 'vitest';
import { faceFor } from './faces';

describe('faceFor', () => {
  it('maps cook, guard, cop, and painter with gender agreement', () => {
    expect(faceFor('cook', 'male')).toBe('👨‍🍳');
    expect(faceFor('cook', 'female')).toBe('👩‍🍳');
    expect(faceFor('guard', 'male')).toBe('💂‍♂️');
    expect(faceFor('guard', 'female')).toBe('💂‍♀️');
    expect(faceFor('cop', 'male')).toBe('👮‍♂️');
    expect(faceFor('cop', 'female')).toBe('👮‍♀️');
    expect(faceFor('painter', 'male')).toBe('👨‍🎨');
    expect(faceFor('painter', 'female')).toBe('👩‍🎨');
  });

  it('falls back to the real renderer default for unknown professions', () => {
    expect(faceFor('plumber', 'male')).toBe('😬');
  });
});
