export enum ExerciseId {
  DUMBBELL_CURL = 'DUMBBELL_CURL',
  CHEST_PRESS = 'CHEST_PRESS',
  SHOULDER_PRESS = 'SHOULDER_PRESS',
  LAT_PULLDOWN = 'LAT_PULLDOWN',
  SEATED_ROW = 'SEATED_ROW',
  TRICEP_PUSHDOWN = 'TRICEP_PUSHDOWN'
}

export type DayType = 'PUSH' | 'PULL';

export interface ExerciseDef {
  id: string; // Changed from ExerciseId to string to allow custom IDs
  name: string;
  muscleGroup: string;
  defaultWeight: number;
  increment: number; // How much to add when progressing
  targetReps: number; // Reps to hit before moving up in weight
  dayType: DayType;
  isCustom?: boolean; // Flag to identify user-created exercises
}

export interface WorkoutLog {
  id: string;
  exerciseId: string; // Changed to string
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