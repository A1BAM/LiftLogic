import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exerciseService } from './exerciseService';
import { logger } from '../utils/logger';
import { ExerciseDef } from '../types';

describe('exerciseService localStorage', () => {
  const STORAGE_KEY = 'liftlogic_custom_exercises';

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('getLocalExercises', () => {
    it('should return an empty array when localStorage is empty', () => {
      const result = exerciseService.getLocalExercises();
      expect(result).toEqual([]);
    });

    it('should return parsed exercises when valid data exists in localStorage', () => {
      const mockExercises: ExerciseDef[] = [
        {
          id: '1',
          name: 'Push Up',
          muscleGroup: 'Chest',
          defaultWeight: 0,
          increment: 0,
          targetReps: 10,
          dayType: 'PUSH'
        }
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mockExercises));

      const result = exerciseService.getLocalExercises();
      expect(result).toEqual(mockExercises);
    });

    it('should return an empty array and log error when JSON is invalid', () => {
      const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
      localStorage.setItem(STORAGE_KEY, 'invalid json');

      const result = exerciseService.getLocalExercises();

      expect(result).toEqual([]);
      expect(loggerSpy).toHaveBeenCalled();
    });
  });

  describe('setLocalExercises', () => {
    it('should store exercises as JSON in localStorage', () => {
      const mockExercises: ExerciseDef[] = [
        {
          id: '2',
          name: 'Pull Up',
          muscleGroup: 'Back',
          defaultWeight: 0,
          increment: 0,
          targetReps: 8,
          dayType: 'PULL'
        }
      ];

      exerciseService.setLocalExercises(mockExercises);

      const stored = localStorage.getItem(STORAGE_KEY);
      expect(stored).toBe(JSON.stringify(mockExercises));
    });
  });
});
