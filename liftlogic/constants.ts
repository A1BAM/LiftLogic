import { ExerciseId, ExerciseDef } from './types';

export const API_URL = '/gym-api';
export const DEFINITION_ID = '__DEFINITION__'; // Special ID to store exercise definitions in the DB

export const EXERCISES: Record<ExerciseId, ExerciseDef> = {
  [ExerciseId.DUMBBELL_CURL]: {
    id: ExerciseId.DUMBBELL_CURL,
    name: "Dumbbell Bicep Curls",
    muscleGroup: "Biceps",
    defaultWeight: 15,
    increment: 5,
    targetReps: 12,
    dayType: 'PULL'
  },
  [ExerciseId.CHEST_PRESS]: {
    id: ExerciseId.CHEST_PRESS,
    name: "Chest Press Machine",
    muscleGroup: "Chest",
    defaultWeight: 60,
    increment: 10,
    targetReps: 10,
    dayType: 'PUSH'
  },
  [ExerciseId.SHOULDER_PRESS]: {
    id: ExerciseId.SHOULDER_PRESS,
    name: "Dumbbell Shoulder Press",
    muscleGroup: "Shoulders",
    defaultWeight: 20,
    increment: 5,
    targetReps: 10,
    dayType: 'PUSH'
  },
  [ExerciseId.LAT_PULLDOWN]: {
    id: ExerciseId.LAT_PULLDOWN,
    name: "Lat Pulldown",
    muscleGroup: "Back",
    defaultWeight: 70,
    increment: 10,
    targetReps: 10,
    dayType: 'PULL'
  },
  [ExerciseId.SEATED_ROW]: {
    id: ExerciseId.SEATED_ROW,
    name: "Seated Row Machine",
    muscleGroup: "Back",
    defaultWeight: 70,
    increment: 10,
    targetReps: 10,
    dayType: 'PULL'
  },
  [ExerciseId.TRICEP_PUSHDOWN]: {
    id: ExerciseId.TRICEP_PUSHDOWN,
    name: "Tricep Pulldown",
    muscleGroup: "Triceps",
    defaultWeight: 30,
    increment: 5,
    targetReps: 12,
    dayType: 'PUSH'
  }
};