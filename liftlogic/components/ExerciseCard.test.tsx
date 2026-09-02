import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ExerciseCard } from './ExerciseCard';
import { WorkoutLog, ExerciseDef } from '../types';

const NOW = new Date(2026, 7, 20, 12, 0, 0).getTime();
const day = (n: number, h = 10) => new Date(2026, 7, 20 - n, h, 0, 0).getTime();
const ex: ExerciseDef = { id: 'CHEST_PRESS', name: 'Chest Press', muscleGroup: 'Chest', defaultWeight: 60, increment: 10, targetReps: 10, dayType: 'PUSH' };
const mk = (id: string, ts: number, w: number, sets = 1): WorkoutLog => ({ id, exerciseId: 'CHEST_PRESS', timestamp: ts, weight: w, reps: 10, sets });

const view = (logs: WorkoutLog[]) => {
  cleanup();
  render(<ExerciseCard exercise={ex} exerciseLogs={logs} onLogClick={()=>{}} onHistoryClick={()=>{}} />);
  return { done: !!screen.queryByText('Done'), text: (document.body.textContent||'').replace(/\s+/g,' ') };
};

describe('ExerciseCard session grouping and completion state', () => {
  beforeAll(() => { vi.setSystemTime(NOW); });

  const history = [
    mk('a', day(2, 18), 100), mk('b', day(2, 17), 100), mk('c', day(2, 16), 100),
    mk('d', day(9, 18), 90), mk('e', day(9, 17), 90),
  ];

  it('not Done when nothing logged today (sorted input)', () => {
    expect(view(history).done).toBe(false);
  });

  it('not Done when nothing logged today, ASCENDING input', () => {
    expect(view([...history].reverse()).done).toBe(false);
  });

  it('ASCENDING input still resolves distinct sessions, not one merged blob', () => {
    const v = view([...history].reverse());
    // reference session is the 3x100 day, so target = 100 + 10
    expect(v.text).toContain('110');
    expect(v.text).not.toContain('Mixed Weights');
    expect(v.text).toContain('3 Sets');
  });

  it('shuffled input matches sorted input exactly', () => {
    const sorted = view(history).text;
    const shuffled = view([history[3], history[0], history[4], history[2], history[1]]).text;
    expect(shuffled).toBe(sorted);
  });

  it('Done only after 3 sets today', () => {
    expect(view([mk('t1', day(0, 11), 100), ...history]).done).toBe(false);
    expect(view([mk('t1', day(0, 11), 100), mk('t2', day(0, 10), 100), ...history]).done).toBe(false);
    expect(view([mk('t1', day(0, 11), 100), mk('t2', day(0, 10), 100), mk('t3', day(0, 9), 100), ...history]).done).toBe(true);
  });

  it('corrupt sets values count as one set, not zero or NaN', () => {
    const bad = [
      mk('t1', day(0, 11), 100, 0),
      mk('t2', day(0, 10), 100, NaN as any),
      mk('t3', day(0, 9), 100, undefined as any),
    ];
    expect(view(bad).done).toBe(true); // 3 rows => 3 sets
    expect(view(bad.slice(0, 2)).done).toBe(false); // 2 rows => 2 sets
  });

  it('future-dated row does not masquerade as today nor become the reference', () => {
    const v = view([mk('future', day(-5, 12), 500), ...history]);
    expect(v.done).toBe(false);
    expect(v.text).toContain('110'); // reference is the 100lb day, not the 500lb future row
    expect(v.text).not.toContain('510');
  });

  it('corrupt timestamps are ignored rather than poisoning grouping', () => {
    const v = view([mk('bad', NaN as any, 999), ...history]);
    expect(v.text).toContain('110');
    expect(v.done).toBe(false);
  });

  it('no logs at all falls back to exercise defaults', () => {
    const v = view([]);
    expect(v.done).toBe(false);
    expect(v.text).toContain('60');
    expect(v.text).toContain('No logs yet');
  });
});
