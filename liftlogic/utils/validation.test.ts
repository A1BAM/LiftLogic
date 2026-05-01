import { describe, it, expect } from 'vitest';
import { validateWorkoutLog, validateDeleteRequest } from './validation';

describe('validation utility', () => {
  describe('validateWorkoutLog', () => {
    const validLog = {
      id: 'log123',
      exerciseId: 'ex456',
      timestamp: 1625097600000,
      weight: 50,
      reps: 10,
      sets: 3,
      notes: 'Good set'
    };

    it('should validate a correct log', () => {
      expect(validateWorkoutLog(validLog)).toEqual({ valid: true });
    });

    it('should reject missing id', () => {
      const { id, ...invalidLog } = validLog;
      expect(validateWorkoutLog(invalidLog)).toHaveProperty('valid', false);
    });

    it('should reject empty id', () => {
      expect(validateWorkoutLog({ ...validLog, id: '' })).toHaveProperty('valid', false);
    });

    it('should reject long id', () => {
      expect(validateWorkoutLog({ ...validLog, id: 'a'.repeat(101) })).toHaveProperty('valid', false);
    });

    it('should reject missing exerciseId', () => {
      const { exerciseId, ...invalidLog } = validLog;
      expect(validateWorkoutLog(invalidLog)).toHaveProperty('valid', false);
    });

    it('should reject negative timestamp', () => {
      expect(validateWorkoutLog({ ...validLog, timestamp: -1 })).toHaveProperty('valid', false);
    });

    it('should reject negative weight', () => {
      expect(validateWorkoutLog({ ...validLog, weight: -10 })).toHaveProperty('valid', false);
    });

    it('should reject long notes', () => {
      expect(validateWorkoutLog({ ...validLog, notes: 'a'.repeat(1001) })).toHaveProperty('valid', false);
    });
  });

  describe('validateDeleteRequest', () => {
    it('should validate request with id', () => {
      expect(validateDeleteRequest({ id: 'log123' })).toEqual({ valid: true });
    });

    it('should validate request with exerciseId', () => {
      expect(validateDeleteRequest({ exerciseId: 'ex456' })).toEqual({ valid: true });
    });

    it('should reject request with neither', () => {
      expect(validateDeleteRequest({})).toHaveProperty('valid', false);
    });

    it('should reject invalid id type', () => {
      expect(validateDeleteRequest({ id: 123 })).toHaveProperty('valid', false);
    });
  });
});
