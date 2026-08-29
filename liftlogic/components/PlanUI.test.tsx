import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import { ExerciseCard } from './ExerciseCard';
import { ExerciseRow } from './ExerciseRow';
import { WORKOUT_PLAN, isSlotComplete, countLoggedSets } from '../workoutPlan';
import { ExerciseDef, WorkoutLog } from '../types';

const NOW = new Date(2026, 7, 24, 12, 0, 0).getTime();
const at = (daysAgo: number, hour: number) =>
  new Date(2026, 7, 24 - daysAgo, hour, 0, 0).getTime();

const bench: ExerciseDef = {
  id: 'custom-1768314623500', name: 'Smith Bench', muscleGroup: 'Chest',
  defaultWeight: 115, increment: 5, targetReps: 10, dayType: 'PUSH'
};
const benchSlot = WORKOUT_PLAN.PUSH![0];

const log = (ts: number, weight: number, reps: number, sets = 1): WorkoutLog =>
  ({ id: `l-${ts}-${weight}-${reps}`, exerciseId: bench.id, timestamp: ts, weight, reps, sets });

// A previous session, so the card has a reference to progress from.
const history = [
  log(at(3, 12), 135, 8), log(at(3, 11), 135, 8), log(at(3, 10), 135, 8)
];

describe('the current lift is unmistakable', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
  afterEach(() => { vi.useRealTimers(); cleanup(); });

  it('labels the current lift START HERE and shows its prescription', () => {
    render(
      <ExerciseCard
        exercise={bench} exerciseLogs={history}
        onLogClick={() => {}} onHistoryClick={() => {}}
        slot={benchSlot} isCurrent showWarmup
      />
    );
    expect(screen.getByText(/start here/i)).toBeInTheDocument();
    // 3 sets, 6-8 reps, 2 minutes rest, straight off the plan.
    expect(screen.getByText(/3 × 6-8 reps · 2 min rest/)).toBeInTheDocument();
  });

  it('does not label a lift that is not the current one', () => {
    render(
      <ExerciseCard
        exercise={bench} exerciseLogs={history}
        onLogClick={() => {}} onHistoryClick={() => {}}
        slot={benchSlot} isCurrent={false}
      />
    );
    expect(screen.queryByText(/start here/i)).not.toBeInTheDocument();
  });

  it('offers the warm-up at roughly half the working weight, and does not log it', () => {
    render(
      <ExerciseCard
        exercise={bench} exerciseLogs={history}
        onLogClick={() => {}} onHistoryClick={() => {}}
        slot={benchSlot} isCurrent showWarmup
      />
    );
    expect(screen.getByText(/5 min easy bike/i)).toBeInTheDocument();
    // Last session was 3x135 at 8 reps, so the target is 140 and half is 70.
    const warmup = screen.getByText(/1 warm-up set ≈ 70 lbs \(not logged\)/i);
    expect(warmup).toBeInTheDocument();
    // Ticking it off is a local checklist, not a logged set.
    fireEvent.click(warmup);
    expect(screen.getByText(/5 min easy bike/i)).toBeInTheDocument();
  });

  it('shows the warm-up on the first lift only', () => {
    render(
      <ExerciseCard
        exercise={bench} exerciseLogs={history}
        onLogClick={() => {}} onHistoryClick={() => {}}
        slot={benchSlot} isCurrent showWarmup={false}
      />
    );
    expect(screen.queryByText(/5 min easy bike/i)).not.toBeInTheDocument();
  });
});

describe('the upcoming exercises', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
  afterEach(() => { vi.useRealTimers(); cleanup(); });

  it('lists its position and prescription, and stays tappable', () => {
    const onLogClick = vi.fn();
    render(
      <ExerciseRow
        exercise={bench} slot={benchSlot} position={3}
        isComplete={false} onLogClick={onLogClick}
      />
    );
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/Bench Press or Dumbbell Press/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Bench Press or Dumbbell Press/));
    expect(onLogClick).toHaveBeenCalledWith(bench);
  });

  it('marks a finished exercise instead of numbering it', () => {
    render(
      <ExerciseRow
        exercise={bench} slot={benchSlot} position={3}
        isComplete onLogClick={() => {}}
      />
    );
    expect(screen.queryByText('3')).not.toBeInTheDocument();
  });
});

describe('advancing to the next lift', () => {
  const todayLog = (sets: number) => log(at(0, 10), 135, 8, sets);

  it('treats an exercise as done only at its prescribed set count', () => {
    expect(isSlotComplete([todayLog(1), todayLog(1)], benchSlot)).toBe(false);
    expect(isSlotComplete([todayLog(1), todayLog(1), todayLog(1)], benchSlot)).toBe(true);
  });

  it('counts a corrupt set value as one set rather than none', () => {
    const broken = { ...todayLog(1), sets: 0 } as WorkoutLog;
    expect(countLoggedSets([broken, broken, broken])).toBe(3);
    expect(isSlotComplete([broken, broken, broken], benchSlot)).toBe(true);
  });

  it('defaults to three sets when a day has no plan', () => {
    expect(isSlotComplete([todayLog(1), todayLog(1)], undefined)).toBe(false);
    expect(isSlotComplete([todayLog(3)], undefined)).toBe(true);
  });
});
