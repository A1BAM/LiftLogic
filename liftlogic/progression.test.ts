import { describe, it, expect } from 'vitest';
import { WorkoutLog } from './types';
import { epley, groupSessions, recommendFor, recommendNext, repsAt, retention } from './progression';

const ID = 'lift';
const day = (iso: string) => new Date(`${iso}T00:00:00`).getTime();

/** "2026-10-31: 115x11 115x10 115x7" per session, as it reads in the journal. */
function history(...lines: string[]): WorkoutLog[] {
  return lines.flatMap(line => {
    const [date, sets] = line.split(': ');
    const noon = new Date(`${date}T12:00:00`).getTime();
    return sets.split(' ').map((set, i) => {
      const [weight, reps] = set.split('x').map(Number);
      return { id: `${date}-${i}`, exerciseId: ID, timestamp: noon + i * 60000, weight, reps, sets: 1 };
    });
  });
}

function next(
  today: string,
  repRange: [number, number],
  lines: string[],
  increment = 5
) {
  return recommendNext({
    sessions: groupSessions(history(...lines), ID),
    targetSets: 3,
    repRange,
    increment,
    defaultWeight: 20,
    todayStart: day(today)
  });
}

describe('the arithmetic', () => {
  it('Epley and its inverse agree', () => {
    expect(epley(100, 10)).toBeCloseTo(133.33, 2);
    expect(repsAt(epley(100, 10), 100)).toBeCloseTo(10);
  });

  it('holds strength for two weeks, then drifts 0.1% a day to a 15% floor', () => {
    expect(retention(0)).toBe(1);
    expect(retention(14)).toBe(1);
    expect(retention(44)).toBeCloseTo(0.97);
    expect(retention(1000)).toBeCloseTo(0.85);
  });
});

describe('recommendNext', () => {
  it('starts a never-logged lift at its default weight', () => {
    expect(next('2026-11-10', [8, 10], [])).toMatchObject({ weight: 20, reps: 8 });
  });

  it('moves up when the next weight is still worth the bottom of the range', () => {
    // 12 reps at 60 is an e1RM of 84, worth 8.8 reps at 65.
    const r = next('2026-11-03', [8, 10], ['2026-10-31: 60x12 60x12 60x12']);
    expect(r).toMatchObject({ weight: 65, reps: 9 });
    expect(r.reason).toMatch(/move up/);
  });

  it('does not move up when the step is too big for the reps, and says what would earn it', () => {
    // The real case: 30 lb curls for 12 are worth about 6 at 35, and the log
    // shows 8, 4, 1 the day that jump was tried.
    const r = next('2026-03-28', [10, 12], ['2026-03-25: 30x12 30x12 30x12']);
    expect(r.weight).toBe(30);
    expect(r.reps).toBe(13);
    expect(r.reason).toMatch(/17 at 30 earns the move to 35/);
  });

  it('prefers a weight you have actually loaded over the nominal increment', () => {
    // 32.5 appears in the history, so it is the next step after 30, not 35.
    const r = next('2026-09-15', [10, 12], [
      '2026-09-01: 32.5x10 32.5x8 32.5x7',
      '2026-09-08: 30x13 30x13 30x13',
      '2026-09-12: 30x13 30x13 30x13'
    ]);
    expect(r.weight).toBe(32.5);
  });

  it('holds the weight when the last set slides under the range', () => {
    const r = next('2026-11-03', [8, 10], ['2026-10-31: 115x11 115x10 115x7']);
    expect(r).toMatchObject({ weight: 115, reps: 10 });
    expect(r.reason).toMatch(/fell to 7/);
  });

  it('does not deload for fatigue: a strong first set means the weight is fine', () => {
    const r = next('2026-11-03', [10, 12], [
      '2026-10-28: 30x12 30x7 30x7',
      '2026-10-31: 30x12 30x7 30x7'
    ]);
    expect(r).toMatchObject({ weight: 30, reps: 10 });
  });

  it('backs off after two sessions where even the best set misses the range', () => {
    const r = next('2026-07-18', [6, 8], [
      '2026-07-10: 165x5 165x4 165x3',
      '2026-07-15: 165x3 165x3 165x3'
    ]);
    expect(r.weight).toBeLessThan(165);
    expect(r.weight).toBeGreaterThanOrEqual(165 * 0.8);
    expect(r.reason).toMatch(/drop to/);
  });

  it('asks for the missing sets before anything else', () => {
    const r = next('2026-11-03', [8, 10], ['2026-10-31: 60x12 60x12']);
    expect(r.weight).toBe(60);
    expect(r.reason).toMatch(/stopped at 2 sets/);
  });

  it('keeps the weight after a few weeks off but expects a rep fewer', () => {
    // 41 days away keeps 97.3%: 8 reps at 160 becomes about 7.
    const r = next('2026-10-29', [6, 8], ['2026-09-18: 160x8 160x8 160x8']);
    expect(r).toMatchObject({ weight: 160, reps: 7 });
    expect(r.reason).toMatch(/6 weeks/);
  });

  it('eases the weight back after a long layoff, by no more than a fifth', () => {
    const r = next('2026-11-10', [8, 10], ['2026-03-11: 60x8 60x8 60x8']);
    expect(r.weight).toBeLessThan(60);
    expect(r.weight).toBeGreaterThanOrEqual(48);
    expect(r.reason).toMatch(/ease back in/);
  });

  it('reads the working weight past a ramp-up set', () => {
    // One lighter opener does not make 155 the weight of the day.
    const r = next('2026-09-02', [6, 8], ['2026-08-31: 155x7 160x7 160x6']);
    expect(r.weight).toBe(160);
  });

  it('does not let today\'s sets move today\'s target', () => {
    const exercise = {
      id: ID, name: 'Row', muscleGroup: 'Back', defaultWeight: 20, increment: 5,
      targetReps: 10, dayType: 'PULL' as const
    };
    const sessions = groupSessions(
      history('2026-10-28: 60x12 60x12 60x12', '2026-10-31: 100x1 100x1 100x1'),
      ID
    );
    const r = recommendFor(exercise, sessions, { sets: 3, reps: [8, 10] }, day('2026-10-31'));
    expect(r.weight).toBe(65);
  });

  it('progresses a bodyweight movement on reps alone', () => {
    const r = next('2026-11-03', [8, 10], ['2026-10-31: 0x9 0x9 0x9']);
    expect(r).toMatchObject({ weight: 0, reps: 10 });
  });

  it('never suggests a weight at or below zero', () => {
    const r = next('2026-11-10', [15, 15], ['2026-03-01: 5x3 5x3 5x3', '2026-03-03: 5x3 5x3 5x3']);
    expect(r.weight).toBeGreaterThan(0);
  });
});
