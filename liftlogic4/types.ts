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
  id: ExerciseId;
  name: string;
  muscleGroup: string;
  defaultWeight: number;
  increment: number; // How much to add when progressing
  targetReps: number; // Reps to hit before moving up in weight
  dayType: DayType;
}

export interface WorkoutLog {
  id: string;
  exerciseId: ExerciseId;
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