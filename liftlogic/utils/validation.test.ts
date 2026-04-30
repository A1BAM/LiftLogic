import { describe, it, expect } from 'vitest';
import { validateWorkoutLog, validateDeleteRequest } from './validation';

describe('validation utils', () => {
  describe('validateWorkoutLog', () => {
    it('should validate a correct workout log', () => {
      const validLog = {
        id: '123',
        exerciseId: 'bench-press',
        timestamp: Date.now(),
        weight: 100,
        reps: 10,
        sets: 3,
        notes: 'Feeling good'
      };
      expect(validateWorkoutLog(validLog).isValid).toBe(true);
    });

    it('should fail if ID is missing or invalid', () => {
      expect(validateWorkoutLog({ exerciseId: '1', timestamp: 1, weight: 1, reps: 1 }).isValid).toBe(false);
      expect(validateWorkoutLog({ id: '', exerciseId: '1', timestamp: 1, weight: 1, reps: 1 }).isValid).toBe(false);
      expect(validateWorkoutLog({ id: 'a'.repeat(101), exerciseId: '1', timestamp: 1, weight: 1, reps: 1 }).isValid).toBe(false);
    });

    it('should fail if exerciseId is missing or invalid', () => {
      expect(validateWorkoutLog({ id: '1', timestamp: 1, weight: 1, reps: 1 }).isValid).toBe(false);
      expect(validateWorkoutLog({ id: '1', exerciseId: '', timestamp: 1, weight: 1, reps: 1 }).isValid).toBe(false);
    });

    it('should fail if numeric values are negative', () => {
      const base = { id: '1', exerciseId: '1', timestamp: 1, weight: 1, reps: 1 };
      expect(validateWorkoutLog({ ...base, weight: -1 }).isValid).toBe(false);
      expect(validateWorkoutLog({ ...base, reps: -1 }).isValid).toBe(false);
      expect(validateWorkoutLog({ ...base, timestamp: -1 }).isValid).toBe(false);
    });

    it('should fail if notes are too long', () => {
      const base = { id: '1', exerciseId: '1', timestamp: 1, weight: 1, reps: 1 };
      expect(validateWorkoutLog({ ...base, notes: 'a'.repeat(1001) }).isValid).toBe(false);
    });
  });

  describe('validateDeleteRequest', () => {
    it('should validate a correct delete request', () => {
      expect(validateDeleteRequest({ id: '123' }).isValid).toBe(true);
      expect(validateDeleteRequest({ exerciseId: '456' }).isValid).toBe(true);
    });

    it('should fail if both ID and exerciseId are missing', () => {
      expect(validateDeleteRequest({}).isValid).toBe(false);
    });

    it('should fail if ID or exerciseId is invalid', () => {
      expect(validateDeleteRequest({ id: 123 }).isValid).toBe(false);
      expect(validateDeleteRequest({ exerciseId: 'a'.repeat(101) }).isValid).toBe(false);
    });
  });
});
