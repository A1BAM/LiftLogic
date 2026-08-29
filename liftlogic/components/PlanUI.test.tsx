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

const press: ExerciseDef = {
  id: 'custom-1784831134576', name: 'Incline Chest Dumbbells', muscleGroup: 'Chest',
  defaultWeight: 55, increment: 5, targetReps: 10, dayType: 'PUSH'
};
const pressSlot = WORKOUT_PLAN.PUSH![0];

const log = (ts: number, weight: number, reps: number, sets = 1): WorkoutLog =>
  ({ id: `l-${ts}-${weight}-${reps}`, exerciseId: press.id, timestamp: ts, weight, reps, sets });

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
        exercise={press} exerciseLogs={history}
        onLogClick={() => {}} onHistoryClick={() => {}}
        slot={pressSlot} isCurrent showWarmup
      />
    );
    expect(screen.getByText(/start here/i)).toBeInTheDocument();
    // 3 sets, 6-8 reps, 2 minutes rest, straight off the plan.
    expect(screen.getByText(/3 × 6-8 reps · 2 min rest/)).toBeInTheDocument();
  });

  it('does not label a lift that is not the current one', () => {
    render(
      <ExerciseCard
        exercise={press} exerciseLogs={history}
        onLogClick={() => {}} onHistoryClick={() => {}}
        slot={pressSlot} isCurrent={false}
      />
    );
    expect(screen.queryByText(/start here/i)).not.toBeInTheDocument();
  });

  it('offers the warm-up at roughly half the working weight, and does not log it', () => {
    render(
      <ExerciseCard
        exercise={press} exerciseLogs={history}
        onLogClick={() => {}} onHistoryClick={() => {}}
        slot={pressSlot} isCurrent showWarmup
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
        exercise={press} exerciseLogs={history}
        onLogClick={() => {}} onHistoryClick={() => {}}
        slot={pressSlot} isCurrent showWarmup={false}
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
        exercise={press} slot={pressSlot} position={3}
        isComplete={false} onLogClick={onLogClick}
      />
    );
    expect(screen.getByText('3')).toBeInTheDocument();
    // The row names the lift actually loaded, so after a swap it is obvious
    // which variant is in the slot.
    expect(screen.getByText('Incline Chest Dumbbells')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Incline Chest Dumbbells'));
    expect(onLogClick).toHaveBeenCalledWith(press);
  });

  it('archives an upcoming lift without promoting it to the top card first', () => {
    const onArchive = vi.fn();
    render(
      <ExerciseRow
        exercise={press} slot={pressSlot} position={3}
        isComplete={false} onLogClick={() => {}} onArchive={onArchive}
      />
    );
    fireEvent.click(screen.getByLabelText('Archive Incline Chest Dumbbells'));
    expect(onArchive).toHaveBeenCalledWith(press);
  });

  it('leaves the archive control off when archiving is not offered', () => {
    render(
      <ExerciseRow
        exercise={press} slot={pressSlot} position={3}
        isComplete={false} onLogClick={() => {}}
      />
    );
    expect(screen.queryByLabelText(/^Archive /)).not.toBeInTheDocument();
  });

  it('marks a finished exercise instead of numbering it', () => {
    render(
      <ExerciseRow
        exercise={press} slot={pressSlot} position={3}
        isComplete onLogClick={() => {}}
      />
    );
    expect(screen.queryByText('3')).not.toBeInTheDocument();
  });
});

describe('advancing to the next lift', () => {
  const todayLog = (sets: number) => log(at(0, 10), 135, 8, sets);

  it('treats an exercise as done only at its prescribed set count', () => {
    expect(isSlotComplete([todayLog(1), todayLog(1)], pressSlot)).toBe(false);
    expect(isSlotComplete([todayLog(1), todayLog(1), todayLog(1)], pressSlot)).toBe(true);
  });

  it('counts a corrupt set value as one set rather than none', () => {
    const broken = { ...todayLog(1), sets: 0 } as WorkoutLog;
    expect(countLoggedSets([broken, broken, broken])).toBe(3);
    expect(isSlotComplete([broken, broken, broken], pressSlot)).toBe(true);
  });

  it('defaults to three sets when a day has no plan', () => {
    expect(isSlotComplete([todayLog(1), todayLog(1)], undefined)).toBe(false);
    expect(isSlotComplete([todayLog(3)], undefined)).toBe(true);
  });
});
