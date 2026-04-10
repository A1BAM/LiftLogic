import { describe, it, expect, vi, beforeEach } from 'vitest';
import { workoutService } from './workoutService';
import { logger } from '../utils/logger';
import { ExerciseDef } from '../types';
import { API_URL } from '../constants';

describe('workoutService localStorage', () => {
  const STORAGE_KEY = 'liftlogic_custom_exercises';

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('getLocalExercises', () => {
    it('should return an empty array when localStorage is empty', () => {
      const result = workoutService.getLocalExercises();
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

      const result = workoutService.getLocalExercises();
      expect(result).toEqual(mockExercises);
    });

    it('should return an empty array and log error when JSON is invalid', () => {
      const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
      localStorage.setItem(STORAGE_KEY, 'invalid json');

      const result = workoutService.getLocalExercises();

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

      workoutService.setLocalExercises(mockExercises);

      const stored = localStorage.getItem(STORAGE_KEY);
      expect(stored).toBe(JSON.stringify(mockExercises));
    });
  });
});

describe('workoutService API Interactions', () => {
  const mockFetch = vi.fn();
  vi.stubGlobal('fetch', mockFetch);

  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('fetchWorkouts', () => {
    it('should fetch and return workout data on success', async () => {
      const mockData = [{ id: '1', exerciseId: 'DUMBBELL_CURL', weight: 20 }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      const result = await workoutService.fetchWorkouts();

      expect(mockFetch).toHaveBeenCalledWith(API_URL, expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      }));
      expect(result).toEqual(mockData);
    });

    it('should throw "Failed to fetch data" when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      await expect(workoutService.fetchWorkouts()).rejects.toThrow('Failed to fetch data');
    });
  });

  describe('saveItem', () => {
    it('should send a POST request with the correct body and return data on success', async () => {
      const payload = { exerciseId: 'PUSH_UP', weight: 0 };
      const mockResponse = { success: true };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await workoutService.saveItem(payload);

      expect(mockFetch).toHaveBeenCalledWith(API_URL, expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      }));
      expect(result).toEqual(mockResponse);
    });

    it('should throw "Failed to save item" when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      await expect(workoutService.saveItem({})).rejects.toThrow('Failed to save item');
    });
  });

  describe('deleteItem', () => {
    it('should send a DELETE request with the correct body and return data on success', async () => {
      const payload = { id: 'log-123' };
      const mockResponse = { deleted: true };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await workoutService.deleteItem(payload);

      expect(mockFetch).toHaveBeenCalledWith(API_URL, expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify(payload),
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      }));
      expect(result).toEqual(mockResponse);
    });

    it('should throw "Failed to delete item" when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      await expect(workoutService.deleteItem({})).rejects.toThrow('Failed to delete item');
    });
  });
});
