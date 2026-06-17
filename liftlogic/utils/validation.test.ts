import { describe, it, expect } from 'vitest';
import { validateWorkoutLogs } from './validation';

describe('validateWorkoutLogs', () => {
  it('should accept a valid array of logs', () => {
    const validLogs = [
      { id: '1', exerciseId: 'E1', timestamp: 12345, weight: 100, reps: 10, sets: 3 },
      { id: '2', exerciseId: 'E2', timestamp: 12346, weight: 200, reps: 5, sets: 4, notes: 'Felt heavy' }
    ];
    expect(() => validateWorkoutLogs(validLogs)).not.toThrow();
    expect(validateWorkoutLogs(validLogs)).toEqual(validLogs);
  });

  it('should throw if input is not an array', () => {
    expect(() => validateWorkoutLogs({})).toThrow("Data must be a list (array) of workouts.");
    expect(() => validateWorkoutLogs('not an array')).toThrow("Data must be a list (array) of workouts.");
  });

  it('should throw if an item is missing required fields', () => {
    const invalidLogs = [
      { id: '1', exerciseId: 'E1', timestamp: 12345, weight: 100, reps: 10, sets: 3 },
      { id: '2', exerciseId: 'E2', timestamp: 12346 } // missing weight, reps, sets
    ];
    expect(() => validateWorkoutLogs(invalidLogs)).toThrow(/Invalid data: Item at index 1/);
  });

  it('should throw if an item has wrong types', () => {
    const invalidLogs = [
      { id: '1', exerciseId: 'E1', timestamp: '12345', weight: 100, reps: 10, sets: 3 } // timestamp should be number
    ];
    expect(() => validateWorkoutLogs(invalidLogs)).toThrow(/Invalid data: Item at index 0/);
  });

  it('should throw if an item has invalid numeric values', () => {
    const invalidLogs = [
      { id: '1', exerciseId: 'E1', timestamp: 12345, weight: -1, reps: 10, sets: 3 } // weight cannot be negative
    ];
    expect(() => validateWorkoutLogs(invalidLogs)).toThrow(/Invalid data: Item at index 0/);
  });

  it('should throw if id or exerciseId is too long', () => {
    const longId = 'a'.repeat(51);
    const invalidLogs = [
      { id: longId, exerciseId: 'E1', timestamp: 12345, weight: 100, reps: 10, sets: 3 }
    ];
    expect(() => validateWorkoutLogs(invalidLogs)).toThrow(/too long/);
  });

  it('should throw if notes is too long', () => {
    const longNotes = 'a'.repeat(501);
    const invalidLogs = [
      { id: '1', exerciseId: 'E1', timestamp: 12345, weight: 100, reps: 10, sets: 3, notes: longNotes }
    ];
    expect(() => validateWorkoutLogs(invalidLogs)).toThrow(/notes' is too long/);
  });

  it('should accept an empty array', () => {
    expect(() => validateWorkoutLogs([])).not.toThrow();
    expect(validateWorkoutLogs([])).toEqual([]);
  });
});
