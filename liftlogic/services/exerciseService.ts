import { ExerciseDef } from '../types';
import { logger } from '../utils/logger';

const STORAGE_KEY = 'liftlogic_custom_exercises';
let cachedExercisesStr: string | null = null;
let cachedExercisesObj: ExerciseDef[] | null = null;

export const exerciseService = {
  getLocalExercises(): ExerciseDef[] {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    if (stored === cachedExercisesStr && cachedExercisesObj) {
      return cachedExercisesObj;
    }
    try {
      const parsed = JSON.parse(stored);
      cachedExercisesStr = stored;
      cachedExercisesObj = parsed;
      return parsed;
    } catch (e) {
      logger.error('Error parsing local exercises', e);
      return [];
    }
  },

  clearLocalExercises() {
    cachedExercisesStr = null;
    cachedExercisesObj = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* Storage may be disabled. */ }
  },

  setLocalExercises(exercises: ExerciseDef[]) {
    const str = JSON.stringify(exercises);
    localStorage.setItem(STORAGE_KEY, str);
    cachedExercisesStr = str;
    cachedExercisesObj = exercises;
  }
};
