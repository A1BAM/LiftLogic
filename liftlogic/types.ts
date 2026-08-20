export enum ExerciseId {
  DUMBBELL_CURL = 'DUMBBELL_CURL',
  CHEST_PRESS = 'CHEST_PRESS',
  SHOULDER_PRESS = 'SHOULDER_PRESS',
  LAT_PULLDOWN = 'LAT_PULLDOWN',
  SEATED_ROW = 'SEATED_ROW',
  TRICEP_PUSHDOWN = 'TRICEP_PUSHDOWN'
}

export type DayType = 'PUSH' | 'PULL' | 'LEGS';

export interface ExerciseDef {
  id: string;
  name: string;
  muscleGroup: string;
  defaultWeight: number;
  increment: number;
  targetReps: number;
  dayType: DayType;
  isCustom?: boolean;
  isArchived?: boolean;
}

export interface WorkoutLog {
  id: string;
  exerciseId: string;
  timestamp: number;
  weight: number;
  reps: number;
  sets: number;
  notes?: string;
}

export interface ProgressionRecommendation {
  weight: number;
  reps: number;
  reason: string;
}
