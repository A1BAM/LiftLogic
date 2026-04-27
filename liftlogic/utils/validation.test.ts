import { describe, it, expect } from 'vitest';
import { validateLog, validateDelete } from './validation';

describe('validation utility', () => {
  describe('validateLog', () => {
    it('should return null for valid log', () => {
      const validLog = {
        id: '123',
        exerciseId: 'bench-press',
        timestamp: Date.now(),
        weight: 100,
        reps: 10,
        sets: 3,
        notes: 'felt good'
      };
      expect(validateLog(validLog)).toBeNull();
    });

    it('should return error for missing id', () => {
      expect(validateLog({ exerciseId: 'ex1' })).toContain('Invalid ID');
    });

    it('should return error for empty id', () => {
        expect(validateLog({ id: ' ', exerciseId: 'ex1' })).toContain('Invalid ID');
      });

    it('should return error for long id', () => {
      expect(validateLog({ id: 'a'.repeat(101), exerciseId: 'ex1' })).toContain('Invalid ID');
    });

    it('should return error for negative weight', () => {
      const invalidLog = {
        id: '123',
        exerciseId: 'ex1',
        timestamp: Date.now(),
        weight: -5,
        reps: 10
      };
      expect(validateLog(invalidLog)).toContain('Invalid weight');
    });

    it('should return error for non-number reps', () => {
        const invalidLog = {
          id: '123',
          exerciseId: 'ex1',
          timestamp: Date.now(),
          weight: 10,
          reps: '10'
        };
        expect(validateLog(invalidLog)).toContain('Invalid reps');
      });

    it('should return error for long notes', () => {
        const invalidLog = {
          id: '123',
          exerciseId: 'ex1',
          timestamp: Date.now(),
          weight: 10,
          reps: 10,
          notes: 'a'.repeat(1001)
        };
        expect(validateLog(invalidLog)).toContain('Invalid notes');
      });
  });

  describe('validateDelete', () => {
    it('should return null for valid delete with id', () => {
      expect(validateDelete({ id: '123' })).toBeNull();
    });

    it('should return null for valid delete with exerciseId', () => {
      expect(validateDelete({ exerciseId: 'ex1' })).toBeNull();
    });

    it('should return error if both missing', () => {
      expect(validateDelete({})).toContain('Missing ID');
    });

    it('should return error for long id', () => {
        expect(validateDelete({ id: 'a'.repeat(101) })).toContain('Invalid ID');
      });
  });
});
