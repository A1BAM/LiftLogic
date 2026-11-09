import { describe, expect, it } from 'vitest';
import { daysAgoLabel, getLocalDateKey, getLocalDayBounds } from './date';

describe('local date utilities', () => {
  it('returns the boundaries of the local calendar day', () => {
    const timestamp = new Date(2026, 7, 20, 12, 30).getTime();
    expect(getLocalDayBounds(timestamp)).toEqual({
      start: new Date(2026, 7, 20).getTime(),
      end: new Date(2026, 7, 21).getTime()
    });
  });

  it('uses the local calendar date as its key', () => {
    expect(getLocalDateKey(new Date(2026, 7, 20, 23, 59).getTime())).toBe('2026-08-20');
  });
});

describe('daysAgoLabel', () => {
  const at = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).getTime();
  const now = at(2026, 8, 20, 9);

  it('uses the words a person would use', () => {
    expect(daysAgoLabel(at(2026, 8, 20, 6), now)).toBe('today');
    expect(daysAgoLabel(at(2026, 8, 19), now)).toBe('yesterday');
    expect(daysAgoLabel(at(2026, 8, 16), now)).toBe('4 days ago');
    expect(daysAgoLabel(at(2026, 8, 12), now)).toBe('last week');
    expect(daysAgoLabel(at(2026, 7, 30), now)).toBe('3 weeks ago');
  });

  it('counts calendar days, so late and early sessions are different days', () => {
    // 11pm yesterday to 1am today is two hours, but it is still yesterday.
    expect(daysAgoLabel(at(2026, 8, 19, 23), at(2026, 8, 20, 1))).toBe('yesterday');
  });

  it('never reads as being in the future', () => {
    expect(daysAgoLabel(at(2026, 8, 21), now)).toBe('today');
  });
});
