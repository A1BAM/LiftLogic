import { describe, it, expect } from 'vitest';
import { validateWorkoutPayload } from './validation';

describe('validateWorkoutPayload', () => {
  it('should return null for a valid payload', () => {
    const payload = {
      id: 'test-id',
      exerciseId: 'test-exercise',
      timestamp: Date.now(),
      weight: 100,
      reps: 10,
      sets: 3,
      notes: 'Some notes'
    };
    expect(validateWorkoutPayload(payload)).toBeNull();
  });

  it('should return an error for invalid ID', () => {
    expect(validateWorkoutPayload({ id: '' })).toBe('Invalid ID: must be a string between 1 and 100 characters');
    expect(validateWorkoutPayload({ id: 'a'.repeat(101) })).toBe('Invalid ID: must be a string between 1 and 100 characters');
    expect(validateWorkoutPayload({ id: 123 })).toBe('Invalid ID: must be a string between 1 and 100 characters');
  });

  it('should return an error for invalid numeric fields', () => {
    expect(validateWorkoutPayload({ weight: -1 })).toBe('Invalid weight: must be a non-negative number');
    expect(validateWorkoutPayload({ reps: '10' })).toBe('Invalid reps: must be a non-negative number');
    expect(validateWorkoutPayload({ sets: Infinity })).toBe('Invalid sets: must be a non-negative number');
  });

  it('should return an error for invalid notes', () => {
    expect(validateWorkoutPayload({ notes: 'a'.repeat(1001) })).toBe('Invalid notes: must be a string up to 1000 characters');
    expect(validateWorkoutPayload({ notes: 123 })).toBe('Invalid notes: must be a string up to 1000 characters');
  });

  it('should allow null notes', () => {
    expect(validateWorkoutPayload({ notes: null })).toBeNull();
  });

  it('should handle empty or null payload', () => {
    expect(validateWorkoutPayload(null)).toBe('Invalid payload format');
    expect(validateWorkoutPayload(undefined)).toBe('Invalid payload format');
  });
});
