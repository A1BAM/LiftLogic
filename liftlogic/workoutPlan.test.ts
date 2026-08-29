import { describe, it, expect } from 'vitest';
import {
  WORKOUT_PLAN, planExercisesForDay, warmupWeight, formatReps, formatRest
} from './workoutPlan';
import { ExerciseDef, DayType } from './types';

const ex = (id: string, dayType: DayType, name = id): ExerciseDef => ({
  id, name, muscleGroup: 'x', defaultWeight: 50, increment: 5, targetReps: 10, dayType
});

// The real IDs, so a renamed or re-pointed slot fails here rather than in a gym.
const PUSH_ORDER = [
  'custom-1768314623500',  // Bench Press or Dumbbell Press
  'custom-1784413338033',  // Overhead Press
  'custom-1774374972187',  // Chest Fly
  'custom-1769021252364',  // Lateral Raise
  'TRICEP_PUSHDOWN'        // Triceps Pulldown
];
const PULL_ORDER = [
  'custom-1774216069316',  // Lat Pulldown
  'custom-1774215986619',  // Seated Row
  'custom-1784413379604',  // Face Pull
  'DUMBBELL_CURL',         // Bicep Curl
  'custom-1768136654079'   // Ab Crunch
];

describe('workout plan', () => {
  it('runs compounds first and isolation last on both days', () => {
    expect(WORKOUT_PLAN.PUSH!.map(s => s.exerciseId)).toEqual(PUSH_ORDER);
    expect(WORKOUT_PLAN.PULL!.map(s => s.exerciseId)).toEqual(PULL_ORDER);
  });

  it('prescribes three sets everywhere, with rest falling as reps rise', () => {
    for (const day of ['PUSH', 'PULL'] as const) {
      const slots = WORKOUT_PLAN[day]!;
      expect(slots).toHaveLength(5);
      for (const s of slots) {
        expect(s.sets).toBe(3);
        expect(s.reps[0]).toBeLessThanOrEqual(s.reps[1]);
        expect([60, 90, 120]).toContain(s.restSeconds);
      }
      // The heavy compounds at the top get the longest rest.
      expect(slots[0].restSeconds).toBe(120);
      expect(slots[4].restSeconds).toBe(60);
    }
  });

  it('orders a shuffled day into the planned sequence', () => {
    const shuffled = [...PUSH_ORDER].reverse().map(id => ex(id, 'PUSH'));
    const planned = planExercisesForDay('PUSH', shuffled);
    expect(planned.map(p => p.exercise.id)).toEqual(PUSH_ORDER);
    expect(planned.map(p => p.position)).toEqual([1, 2, 3, 4, 5]);
  });

  it('fills slot 1 with the primary and hides the unused alternative', () => {
    // Both the bench and the dumbbell press are active, as they are today.
    const active = [...PUSH_ORDER, 'custom-1784831134576'].map(id => ex(id, 'PUSH'));
    const planned = planExercisesForDay('PUSH', active);
    expect(planned).toHaveLength(5);
    expect(planned[0].exercise.id).toBe('custom-1768314623500');
    expect(planned.map(p => p.exercise.id)).not.toContain('custom-1784831134576');
  });

  it('falls back to the alternative when the primary is archived away', () => {
    const active = PUSH_ORDER.slice(1).map(id => ex(id, 'PUSH'));
    active.unshift(ex('custom-1784831134576', 'PUSH'));
    const planned = planExercisesForDay('PUSH', active);
    expect(planned[0].exercise.id).toBe('custom-1784831134576');
    expect(planned).toHaveLength(5);
  });

  it('skips a slot whose exercises are all missing rather than breaking', () => {
    const active = PULL_ORDER.slice(0, 3).map(id => ex(id, 'PULL'));
    const planned = planExercisesForDay('PULL', active);
    expect(planned.map(p => p.exercise.id)).toEqual(PULL_ORDER.slice(0, 3));
    expect(planned.map(p => p.position)).toEqual([1, 2, 3]);
  });

  it('lists an exercise added later after the plan instead of dropping it', () => {
    const active = [...PULL_ORDER.map(id => ex(id, 'PULL')), ex('custom-new', 'PULL')];
    const planned = planExercisesForDay('PULL', active);
    expect(planned).toHaveLength(6);
    expect(planned[5].exercise.id).toBe('custom-new');
    expect(planned[5].slot).toBeUndefined();
  });

  it('leaves unplanned days in their existing order', () => {
    const legs = [ex('a', 'LEGS'), ex('b', 'LEGS')];
    const planned = planExercisesForDay('LEGS', legs);
    expect(planned.map(p => p.exercise.id)).toEqual(['a', 'b']);
    expect(planned.every(p => p.slot === undefined)).toBe(true);
  });

  it('rounds the warm-up to a loadable weight at about half', () => {
    expect(warmupWeight(100)).toBe(50);
    expect(warmupWeight(135)).toBe(70);   // 67.5 -> nearest 5
    expect(warmupWeight(0)).toBe(0);
  });

  it('reads a rep range as a range and a single target as one number', () => {
    expect(formatReps({ ...WORKOUT_PLAN.PUSH![0] })).toBe('6-8 reps');
    expect(formatReps({ ...WORKOUT_PLAN.PULL![2] })).toBe('15 reps');
    expect(formatRest({ ...WORKOUT_PLAN.PUSH![0] })).toBe('2 min rest');
    expect(formatRest({ ...WORKOUT_PLAN.PUSH![4] })).toBe('60 sec rest');
  });
});
