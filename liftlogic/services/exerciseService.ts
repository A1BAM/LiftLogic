import { ExerciseDef } from '../types';
import { logger } from '../utils/logger';

let cachedExercisesStr: string | null = null;
let cachedExercisesObj: ExerciseDef[] | null = null;

export const exerciseService = {
  getLocalExercises(): ExerciseDef[] {
    const stored = localStorage.getItem('liftlogic_custom_exercises');
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

  setLocalExercises(exercises: ExerciseDef[]) {
    const str = JSON.stringify(exercises);
    localStorage.setItem('liftlogic_custom_exercises', str);
    cachedExercisesStr = str;
    cachedExercisesObj = exercises;
  }
};
