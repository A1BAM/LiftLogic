import { DayType, ExerciseDef, WorkoutLog } from './types';

/**
 * The fixed Push/Pull running order.
 *
 * Order is deliberate: compounds first while you are fresh, isolation last.
 * It is data, not something the UI lets you rearrange, so opening a day always
 * presents the same sequence.
 *
 * Slots are keyed on exercise IDs, never names, so renaming a lift in the app
 * cannot detach it from its slot or from its logged history.
 */
export interface PlanSlot {
  /** The exercise normally used for this slot. */
  exerciseId: string;
  /**
   * Interchangeable lifts for the same slot, e.g. "Bench Press or Dumbbell
   * Press". Whichever is currently un-archived fills the slot; the others stay
   * out of the day's list but keep their history and can be swapped in.
   */
  alternatives?: string[];
  /** How the slot reads on the card, including any "or" wording. */
  label: string;
  sets: number;
  /** Inclusive rep range, e.g. [6, 8]. Progression targets the top of it. */
  reps: [number, number];
  restSeconds: number;
}

export const WORKOUT_PLAN: Partial<Record<DayType, PlanSlot[]>> = {
  PUSH: [
    {
      exerciseId: 'custom-1784831134576',            // Incline Chest Dumbbells
      alternatives: [
        'custom-1768314623500',                      // Smith Bench
        'custom-1768314721281',                      // Smith Incline Bench
        'CHEST_PRESS'                                // Chest Press Machine
      ],
      label: 'Dumbbell Press or Bench Press',
      sets: 3, reps: [6, 8], restSeconds: 120
    },
    {
      exerciseId: 'custom-1784413338033',            // Overhead Press
      alternatives: [
        'custom-1767381863458',                      // Machine Shoulder Press
        'SHOULDER_PRESS'                             // Dumbbell Shoulder Press
      ],
      label: 'Overhead Press (DB or machine)',
      sets: 3, reps: [8, 10], restSeconds: 120
    },
    {
      exerciseId: 'custom-1774374972187',            // Chest Fly
      label: 'Chest Fly',
      sets: 3, reps: [10, 12], restSeconds: 90
    },
    {
      exerciseId: 'custom-1769021252364',            // Barbell/Dumbell Lateral Raise
      label: 'Lateral Raise',
      sets: 3, reps: [12, 15], restSeconds: 60
    },
    {
      exerciseId: 'TRICEP_PUSHDOWN',
      label: 'Triceps Pulldown',
      sets: 3, reps: [12, 15], restSeconds: 60
    }
  ],
  PULL: [
    {
      exerciseId: 'custom-1774216069316',            // Lat Pulldown (Cable)
      alternatives: ['LAT_PULLDOWN'],                // Lat Pulldown (machine)
      label: 'Lat Pulldown',
      sets: 3, reps: [8, 10], restSeconds: 120
    },
    {
      exerciseId: 'custom-1774215986619',            // Seated Row Machine (Cable)
      alternatives: ['SEATED_ROW'],                  // Seated Row Machine
      label: 'Seated Row',
      sets: 3, reps: [8, 10], restSeconds: 120
    },
    {
      exerciseId: 'custom-1784413379604',            // Face Pulls
      label: 'Face Pull or Rear Delt Fly',
      sets: 3, reps: [15, 15], restSeconds: 60
    },
    {
      exerciseId: 'DUMBBELL_CURL',
      label: 'Bicep Curl',
      sets: 3, reps: [10, 12], restSeconds: 60
    },
    {
      exerciseId: 'custom-1768136654079',            // Abdominal Crunch
      label: 'Ab Crunch',
      sets: 3, reps: [15, 15], restSeconds: 60
    }
  ]
};

/** The warm-up, shown on the first exercise of a planned day only. */
export const WARMUP = {
  cardioMinutes: 5,
  cardioLabel: '5 min easy bike',
  /** One light set at about half the working weight. Never logged. */
  workingWeightFraction: 0.5
};

/** Rounds a warm-up weight to something you can actually load. */
export function warmupWeight(workingWeight: number): number {
  const half = workingWeight * WARMUP.workingWeightFraction;
  return Math.max(0, Math.round(half / 5) * 5);
}

/**
 * Sets logged today. A row always counts as at least one set, so a corrupt or
 * legacy `sets` value of 0 cannot make a finished exercise look unfinished.
 */
export function countLoggedSets(logs: WorkoutLog[]): number {
  return logs.reduce((acc, log) => {
    const n = Math.floor(Number(log.sets));
    return acc + (Number.isFinite(n) && n > 0 ? n : 1);
  }, 0);
}

/** Whether an exercise has met its prescribed set count for the day. */
export function isSlotComplete(logs: WorkoutLog[], slot?: PlanSlot): boolean {
  return countLoggedSets(logs) >= (slot?.sets ?? 3);
}

export function formatReps(slot: PlanSlot): string {
  const [lo, hi] = slot.reps;
  return lo === hi ? `${lo} reps` : `${lo}-${hi} reps`;
}

export function formatRest(slot: PlanSlot): string {
  return slot.restSeconds >= 120
    ? `${slot.restSeconds / 60} min rest`
    : `${slot.restSeconds} sec rest`;
}

/** The slot an exercise fills on a given day, if any. */
export function slotFor(day: DayType | null, exerciseId: string): PlanSlot | undefined {
  const plan = day ? WORKOUT_PLAN[day] : undefined;
  return plan?.find(
    s => s.exerciseId === exerciseId || (s.alternatives ?? []).includes(exerciseId)
  );
}

/**
 * The other lifts that can fill the same slot: the swaps that make sense for
 * this exercise, not every exercise you have.
 *
 * Archived ones are left out. An archived exercise is meant to be gone from
 * the app entirely — the archive list in the main menu is the one place it
 * shows up, and restoring it there is what brings it back into circulation.
 *
 * An exercise with no slot, or a slot whose other lifts are all archived, gets
 * nothing back, so the UI can leave the switch control off entirely.
 */
export function switchOptionsFor(
  day: DayType | null,
  exerciseId: string,
  all: ExerciseDef[]
): ExerciseDef[] {
  const slot = slotFor(day, exerciseId);
  if (!slot) return [];
  const byId = new Map(all.map(e => [e.id, e]));
  return [slot.exerciseId, ...(slot.alternatives ?? [])]
    .filter(id => id !== exerciseId)
    .map(id => byId.get(id))
    .filter((e): e is ExerciseDef => !!e && !e.isArchived);
}

export interface PlannedExercise {
  exercise: ExerciseDef;
  /** Undefined for exercises outside the plan, which are listed after it. */
  slot?: PlanSlot;
  /** 1-based position, for the numbers shown down the list. */
  position: number;
}

/**
 * Orders a day's exercises by the plan.
 *
 * Each slot is filled by whichever of its exercises is currently active,
 * preferring the primary. Anything active on this day that no slot claims is
 * appended afterwards rather than vanishing, so an exercise added later is
 * still reachable.
 */
export function planExercisesForDay(
  day: DayType | null,
  active: ExerciseDef[]
): PlannedExercise[] {
  const plan = day ? WORKOUT_PLAN[day] : undefined;
  if (!plan) {
    return active.map((exercise, i) => ({ exercise, position: i + 1 }));
  }

  const byId = new Map(active.map(e => [e.id, e]));
  const claimed = new Set<string>();
  const ordered: PlannedExercise[] = [];

  for (const slot of plan) {
    const candidates = [slot.exerciseId, ...(slot.alternatives ?? [])];
    // Every candidate is spoken for, so an unused alternative does not also
    // appear on its own further down the list.
    candidates.forEach(id => claimed.add(id));
    const filledBy = candidates.find(id => byId.has(id));
    if (filledBy) {
      ordered.push({ exercise: byId.get(filledBy)!, slot, position: ordered.length + 1 });
    }
  }

  for (const exercise of active) {
    if (!claimed.has(exercise.id)) {
      ordered.push({ exercise, position: ordered.length + 1 });
    }
  }
  return ordered;
}
