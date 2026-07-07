import { describe, expect, it } from 'vitest';
import { parseHash } from './router';

describe('parseHash', () => {
  it('routes #/ and empty/garbage hashes to the archive', () => {
    expect(parseHash('')).toEqual({ screen: 'archive' });
    expect(parseHash('#/')).toEqual({ screen: 'archive' });
    expect(parseHash('#/nonsense')).toEqual({ screen: 'archive' });
    expect(parseHash('#/play/not-a-date')).toEqual({ screen: 'archive' });
  });

  it('routes #/play/<date> to the game', () => {
    expect(parseHash('#/play/2026-07-07')).toEqual({ screen: 'play', date: '2026-07-07' });
  });
});
