import { describe, it, expect } from 'vitest';
import { validateId, validateNote, validateNonNegativeNumber, validateWorkoutPayload } from './validation';

describe('Validation Utilities', () => {
  describe('validateId', () => {
    it('should return true for valid string IDs', () => {
      expect(validateId('test-id')).toBe(true);
      expect(validateId('a'.repeat(100))).toBe(true);
    });

    it('should return false for empty, non-string, or too long IDs', () => {
      expect(validateId('')).toBe(false);
      expect(validateId(null)).toBe(false);
      expect(validateId(123)).toBe(false);
      expect(validateId('a'.repeat(101))).toBe(false);
    });
  });

  describe('validateNote', () => {
    it('should return true for valid or empty notes', () => {
      expect(validateNote('test note')).toBe(true);
      expect(validateNote('')).toBe(true);
      expect(validateNote(null)).toBe(true);
      expect(validateNote(undefined)).toBe(true);
      expect(validateNote('a'.repeat(1000))).toBe(true);
    });

    it('should return false for too long or non-string notes', () => {
      expect(validateNote('a'.repeat(1001))).toBe(false);
      expect(validateNote(123)).toBe(false);
    });
  });

  describe('validateNonNegativeNumber', () => {
    it('should return true for valid non-negative numbers', () => {
      expect(validateNonNegativeNumber(0)).toBe(true);
      expect(validateNonNegativeNumber(123)).toBe(true);
      expect(validateNonNegativeNumber(123.45)).toBe(true);
    });

    it('should return false for negative numbers, NaN, or non-numbers', () => {
      expect(validateNonNegativeNumber(-1)).toBe(false);
      expect(validateNonNegativeNumber(NaN)).toBe(false);
      expect(validateNonNegativeNumber('123')).toBe(false);
      expect(validateNonNegativeNumber(null)).toBe(false);
    });
  });

  describe('validateWorkoutPayload', () => {
    it('should return isValid true for complete valid payloads', () => {
      const payload = {
        id: 'log-1',
        exerciseId: 'DUMBBELL_CURL',
        timestamp: Date.now(),
        weight: 20,
        reps: 10,
        sets: 3,
        notes: 'Good session'
      };
      expect(validateWorkoutPayload(payload)).toEqual({ isValid: true });
    });

    it('should return error for missing or invalid fields', () => {
      expect(validateWorkoutPayload(null).isValid).toBe(false);
      expect(validateWorkoutPayload({ id: '', exerciseId: 'EX' }).error).toBe('Invalid ID');
      expect(validateWorkoutPayload({ id: 'ID', exerciseId: '', weight: 10 }).error).toBe('Invalid Exercise ID');
      expect(validateWorkoutPayload({ id: 'ID', exerciseId: 'EX', timestamp: -1 }).error).toBe('Invalid timestamp');
      expect(validateWorkoutPayload({ id: 'ID', exerciseId: 'EX', timestamp: 123, weight: -1 }).error).toBe('Invalid weight');
      expect(validateWorkoutPayload({ id: 'ID', exerciseId: 'EX', timestamp: 123, weight: 10, reps: -1 }).error).toBe('Invalid reps');
      expect(validateWorkoutPayload({ id: 'ID', exerciseId: 'EX', timestamp: 123, weight: 10, reps: 10, sets: -1 }).error).toBe('Invalid sets');
      expect(validateWorkoutPayload({ id: 'ID', exerciseId: 'EX', timestamp: 123, weight: 10, reps: 10, notes: 'a'.repeat(1001) }).error).toBe('Note too long');
    });
  });
});
