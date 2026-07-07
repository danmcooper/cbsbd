// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { saveProgress } from '../game/storage';
import { groupByMonth, statusFor } from './archiveData';

const entry = (date: string) => ({ date, id: 'a6f09e2713b2', difficulty: 'Easy', title: 'T' });

beforeEach(() => localStorage.clear());

describe('groupByMonth', () => {
  it('groups date-descending entries into labeled months', () => {
    const groups = groupByMonth([entry('2026-07-03'), entry('2026-07-01'), entry('2026-06-30')]);
    expect(groups.map((g) => g.month)).toEqual(['July 2026', 'June 2026']);
    expect(groups[0].entries.map((e) => e.date)).toEqual(['2026-07-03', '2026-07-01']);
  });
});

describe('statusFor', () => {
  it('maps missing/in-progress/completed progress to statuses', () => {
    expect(statusFor('a6f09e2713b2')).toBe('unplayed');
    saveProgress('a6f09e2713b2', { flipped: [0], mistakes: 0, elapsedMs: 0, completed: false });
    expect(statusFor('a6f09e2713b2')).toBe('in progress');
    saveProgress('a6f09e2713b2', { flipped: [0, 1], mistakes: 1, elapsedMs: 5, completed: true });
    expect(statusFor('a6f09e2713b2')).toBe('done');
  });
});
