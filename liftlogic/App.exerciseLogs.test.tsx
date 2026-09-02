import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ExerciseCard } from './components/ExerciseCard';
import { ExerciseDef, WorkoutLog } from './types';

/**
 * Regression guard for the defect where App passed the global `logs` array to
 * every ExerciseCard instead of that exercise's own logs. Every card then saw
 * every exercise's history: today's sets summed across all exercises (so each
 * card read "Done"), and the reference session became the most recent day any
 * exercise was trained, so the target came from an unrelated lift.
 *
 * Shape mirrors the production data that surfaced it: sets logged today on
 * three different exercises, and a heavier unrelated lift two weeks back.
 */
const NOW = new Date(2026, 7, 20, 14, 0, 0).getTime();
const at = (daysAgo: number, hour: number) =>
  new Date(2026, 7, 20 - daysAgo, hour, 0, 0).getTime();

const tricep: ExerciseDef = {
  id: 'TRICEP_PUSHDOWN', name: 'Tricep Pulldown', muscleGroup: 'Triceps',
  defaultWeight: 30, increment: 5, targetReps: 12, dayType: 'PUSH'
};

const log = (exerciseId: string, ts: number, weight: number, reps: number): WorkoutLog =>
  ({ id: `${exerciseId}-${ts}`, exerciseId, timestamp: ts, weight, reps, sets: 1 });

const tricepOwn = [
  log('TRICEP_PUSHDOWN', at(0, 12), 50, 10),
  log('TRICEP_PUSHDOWN', at(14, 11), 50, 11),
  log('TRICEP_PUSHDOWN', at(14, 10), 50, 11),
  log('TRICEP_PUSHDOWN', at(14, 9), 45, 11)
];

const otherExercises = [
  log('CHEST_FLY', at(0, 11), 27, 12),
  log('CHEST_FLY', at(0, 10), 27, 12),
  log('INCLINE_DB', at(0, 9), 45, 9),
  log('SMITH_INCLINE', at(13, 10), 110, 8),
  log('SMITH_INCLINE', at(13, 9), 110, 8),
  log('SMITH_INCLINE', at(13, 8), 110, 8)
];

const view = (logs: WorkoutLog[]) => {
  cleanup();
  render(
    <ExerciseCard
      exercise={tricep}
      exerciseLogs={logs}
      onLogClick={() => {}}
      onHistoryClick={() => {}}
    />
  );
  return {
    done: !!screen.queryByText('Done'),
    text: (document.body.textContent || '').replace(/\s+/g, ' ')
  };
};

describe('ExerciseCard receives only its own exercise logs', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
  afterEach(() => { vi.useRealTimers(); cleanup(); });

  it('is not Done on one set today, and targets off its own last session', () => {
    const v = view(tricepOwn);
    expect(v.done).toBe(false);
    expect(v.text).not.toContain('110');
  });

  it('does not count other exercises toward this card', () => {
    const polluted = [...tricepOwn, ...otherExercises].sort((a, b) => b.timestamp - a.timestamp);
    const own = view(tricepOwn);
    const all = view(polluted);
    expect(all.done).toBe(own.done);
    expect(all.text).toBe(own.text);
  });
});
