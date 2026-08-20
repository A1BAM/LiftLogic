import { describe, expect, it } from 'vitest';
import { getLocalDateKey, getLocalDayBounds } from './date';

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
