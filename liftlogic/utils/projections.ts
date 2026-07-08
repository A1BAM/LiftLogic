import { UserProfile, ExerciseDef, WorkoutLog } from '../types';

export interface ExerciseProjections {
  current1RM: number;
  goal3Months: number;
  goal1Year: number;
  lifetimeMax: number;
}

// Epley Formula for 1RM: Weight * (1 + (Reps / 30))
export const calculate1RM = (weight: number, reps: number): number => {
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
};

export const getProjections = (
  exercise: ExerciseDef,
  logs: WorkoutLog[],
  profile: UserProfile | null
): ExerciseProjections | null => {
  if (!logs || logs.length === 0 || !profile) return null;

  // Find the max 1RM from the last few logs to get a baseline
  let max1RM = 0;
  for (const log of logs) {
    const rm = calculate1RM(log.weight, log.reps);
    if (rm > max1RM) max1RM = rm;
  }

  // 1. Lifetime Max based on Martin Berkhan's formula + age adjustments
  // Max Lean Mass = Height in cm - 100 (in kg)
  const maxLeanMassKg = profile.heightCm - 100;
  const maxLeanMassLbs = maxLeanMassKg * 2.20462;

  let multiplier = 1.0;
  const name = exercise.name.toLowerCase();
  const group = exercise.muscleGroup.toLowerCase();

  // Multipliers for intermediate/advanced lifters
  if (group.includes('chest') || name.includes('bench')) {
    multiplier = 1.5;
  } else if (group.includes('legs') || name.includes('squat')) {
    multiplier = 2.0;
  } else if (group.includes('back') || name.includes('deadlift')) {
    multiplier = 2.5;
  } else if (group.includes('shoulder') || name.includes('press')) {
    multiplier = 1.0;
  } else {
    // Isolation/accessories
    multiplier = 0.5;
  }

  let lifetimeMax = Math.round(maxLeanMassLbs * multiplier);

  // Age multiplier (Testosterone & recovery limits)
  // Assumes peak in 20s-30s, slow decline after 40
  if (profile.age) {
    if (profile.age > 40 && profile.age <= 50) {
      lifetimeMax = Math.round(lifetimeMax * 0.9);
    } else if (profile.age > 50 && profile.age <= 60) {
      lifetimeMax = Math.round(lifetimeMax * 0.8);
    } else if (profile.age > 60) {
      lifetimeMax = Math.round(lifetimeMax * 0.7);
    }
  }

  // 2. Realistic 3-month and 1-year goals for someone working full time
  // Assumes non-linear progression that slows down as you approach the lifetime max.
  const distanceToMax = lifetimeMax - max1RM;

  let goal3Months = max1RM;
  let goal1Year = max1RM;

  if (distanceToMax > 0) {
    // If very far from max (beginner), they can progress fast
    // If close to max (advanced), progress is extremely slow
    const percentageOfMax = max1RM / lifetimeMax;

    if (percentageOfMax < 0.5) {
      // Beginner: can add ~15% in 3 months, ~40% in a year
      goal3Months = Math.round(max1RM * 1.15);
      goal1Year = Math.round(max1RM * 1.4);
    } else if (percentageOfMax < 0.8) {
      // Intermediate: can add ~5% in 3 months, ~15% in a year
      goal3Months = Math.round(max1RM + (distanceToMax * 0.1));
      goal1Year = Math.round(max1RM + (distanceToMax * 0.3));
    } else {
      // Advanced: can add maybe 1-2% in 3 months, 5% in a year
      goal3Months = Math.round(max1RM + (distanceToMax * 0.05));
      goal1Year = Math.round(max1RM + (distanceToMax * 0.15));
    }
  }

  // Cap goals at lifetime max
  if (goal3Months > lifetimeMax) goal3Months = lifetimeMax;
  if (goal1Year > lifetimeMax) goal1Year = lifetimeMax;

  // Make sure goals don't regress if they're already past them
  if (goal3Months < max1RM) goal3Months = max1RM;
  if (goal1Year < max1RM) goal1Year = max1RM;

  return {
    current1RM: max1RM,
    goal3Months,
    goal1Year,
    lifetimeMax
  };
};
