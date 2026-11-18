import { describe, it, expect } from 'vitest';
import { buildBackup, buildCsv, parseBackup, serializeBackup, validateExercise } from './backup';
import { ExerciseDef, WorkoutLog } from '../types';

const curl: ExerciseDef = {
  id: 'DUMBBELL_CURL', name: 'Dumbbell Bicep Curls', muscleGroup: 'Biceps',
  defaultWeight: 25, increment: 5, targetReps: 12, dayType: 'PULL'
};
const custom: ExerciseDef = {
  id: 'custom-1', name: 'Face Pulls', muscleGroup: 'Rear delts',
  defaultWeight: 20, increment: 5, targetReps: 15, dayType: 'PULL', isCustom: true
};
const T = Date.UTC(2026, 10, 1, 17, 30);
const log = (id: string, exerciseId: string, minutes: number, weight: number, reps: number, sets = 1): WorkoutLog =>
  ({ id, exerciseId, timestamp: T + minutes * 60_000, weight, reps, sets });

describe('buildBackup', () => {
  it('holds every set and the exercises, oldest set first, with readable dates', () => {
    const backup = buildBackup([log('b', 'DUMBBELL_CURL', 2, 27.5, 9), log('a', 'custom-1', 0, 30, 12)], [curl, custom], T);
    expect(backup).toMatchObject({ app: 'liftlogic', version: 2, exportedAt: '2026-11-01T17:30:00.000Z' });
    expect(backup.sets.map(s => s.id)).toEqual(['a', 'b']);
    expect(backup.sets[1]).toEqual({ id: 'b', exerciseId: 'DUMBBELL_CURL', at: '2026-11-01T17:32:00.000Z', weight: 27.5, reps: 9 });
    expect(backup.exercises.map(e => e.id)).toEqual(['DUMBBELL_CURL', 'custom-1']);
  });

  it('is much smaller than the old pretty-printed clipboard export', () => {
    const logs = Array.from({ length: 1000 }, (_, i) =>
      ({ ...log(`00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, 'custom-1774216069316', i, 60, 10), notes: null as unknown as undefined }));
    const before = JSON.stringify(logs, null, 2).length;
    const after = serializeBackup(buildBackup(logs, [custom])).length;
    expect(after).toBeLessThan(before * 0.7);
  });

  it('writes a legacy multi-set row out as that many sets', () => {
    const backup = buildBackup([log('x', 'DUMBBELL_CURL', 0, 30, 10, 3)], [curl]);
    expect(backup.sets.map(s => s.id)).toEqual(['x', 'x~1', 'x~2']);
  });
});

describe('parseBackup', () => {
  it('restores what buildBackup wrote, exactly', () => {
    const logs = [log('a', 'custom-1', 0, 30, 12), log('b', 'DUMBBELL_CURL', 2, 27.5, 9)];
    const parsed = parseBackup(serializeBackup(buildBackup(logs, [curl, custom])));
    expect(parsed.logs).toEqual(logs.map(l => ({ ...l, sets: 1 })));
    expect(parsed.exercises).toEqual([curl, custom]);
  });

  it('still reads the old clipboard export, a bare array of rows', () => {
    const old = [{ id: 'a', exerciseId: 'custom-1', timestamp: T, weight: 30, reps: 12, sets: 1, notes: null }];
    expect(parseBackup(JSON.stringify(old, null, 2)).logs).toEqual([{ ...old[0], notes: undefined }]);
  });

  it('turns definition rows in an old array into exercises, not sets', () => {
    const old = [
      { id: 'def_custom-1', exerciseId: '__DEFINITION__', timestamp: T, weight: 0, reps: 0, sets: 0, notes: JSON.stringify(custom) },
      { id: 'a', exerciseId: 'custom-1', timestamp: T, weight: 30, reps: 12, sets: 1 }
    ];
    const parsed = parseBackup(JSON.stringify(old));
    expect(parsed.logs.map(l => l.id)).toEqual(['a']);
    expect(parsed.exercises).toEqual([custom]);
  });

  it('explains what is wrong rather than failing silently', () => {
    expect(() => parseBackup('not json')).toThrow(/not valid JSON/);
    expect(() => parseBackup('{"hello":"world"}')).toThrow(/isn't a LiftLogic backup/);
    expect(() => parseBackup('{"app":"liftlogic","version":9,"sets":[]}')).toThrow(/newer version/);
    expect(() => parseBackup('{"app":"liftlogic","version":2,"sets":[{"id":"a","exerciseId":"x","at":"yesterday","weight":1,"reps":1}]}'))
      .toThrow(/timestamp/);
  });

  it('drops an exercise that is malformed or too big to store, keeping the rest', () => {
    const backup = { app: 'liftlogic', version: 2, sets: [], exercises: [custom, { ...curl, dayType: 'ARMS' }, { ...curl, id: 'x'.repeat(60) }] };
    expect(parseBackup(JSON.stringify(backup)).exercises).toEqual([custom]);
  });
});

describe('validateExercise', () => {
  it('keeps only known fields', () => {
    expect(validateExercise({ ...curl, isArchived: true, evil: '<script>' })).toEqual({ ...curl, isArchived: true });
  });
});

describe('buildCsv', () => {
  it('writes one row per set with a header, oldest first', () => {
    const csv = buildCsv([log('b', 'DUMBBELL_CURL', 1, 27.5, 9), log('a', 'DUMBBELL_CURL', 0, 30, 12)], { DUMBBELL_CURL: curl });
    const rows = csv.trim().split('\r\n');
    expect(rows[0]).toBe('Date,Time,Day,Exercise,Weight (lbs),Reps');
    expect(rows).toHaveLength(3);
    expect(rows[1]).toMatch(/^\d{4}-\d{2}-\d{2},\d{2}:\d{2},Pull,Dumbbell Bicep Curls,30,12$/);
    expect(rows[2].endsWith(',27.5,9')).toBe(true);
  });

  it('quotes commas and quotes, and never lets a name run as a formula', () => {
    const odd = { ...curl, id: 'odd', name: '=HYPERLINK("http://x"), "Curl"' };
    const row = buildCsv([log('a', 'odd', 0, 30, 12)], { odd }).trim().split('\r\n')[1];
    expect(row).toContain(`"'=HYPERLINK(""http://x""), ""Curl"""`);
  });

  it('names a set whose exercise is gone instead of leaving a blank', () => {
    expect(buildCsv([log('a', 'gone', 0, 30, 12)], {})).toContain(',,Deleted exercise,30,12');
  });
});
