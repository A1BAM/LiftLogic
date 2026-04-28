import { describe, it, expect } from 'vitest';
import { validateWorkoutLog } from './validation';

describe('validateWorkoutLog', () => {
  const validLog = {
    id: 'test-id',
    exerciseId: 'test-exercise',
    timestamp: Date.now(),
    weight: 100,
    reps: 10,
    sets: 3,
    notes: 'Feeling strong'
  };

  it('should return valid for correct data', () => {
    expect(validateWorkoutLog(validLog)).toEqual({ isValid: true });
  });

  it('should return valid without optional notes', () => {
    const { notes, ...withoutNotes } = validLog;
    expect(validateWorkoutLog(withoutNotes)).toEqual({ isValid: true });
  });

  it('should return invalid for missing id', () => {
    const { id, ...invalid } = validLog;
    expect(validateWorkoutLog(invalid)).toMatchObject({ isValid: false, error: /ID/ });
  });

  it('should return invalid for empty id', () => {
    expect(validateWorkoutLog({ ...validLog, id: '' })).toMatchObject({ isValid: false, error: /ID/ });
  });

  it('should return invalid for long id', () => {
    expect(validateWorkoutLog({ ...validLog, id: 'a'.repeat(101) })).toMatchObject({ isValid: false, error: /ID/ });
  });

  it('should return invalid for negative numbers', () => {
    expect(validateWorkoutLog({ ...validLog, weight: -1 })).toMatchObject({ isValid: false, error: /weight/ });
    expect(validateWorkoutLog({ ...validLog, reps: -1 })).toMatchObject({ isValid: false, error: /reps/ });
    expect(validateWorkoutLog({ ...validLog, timestamp: -1 })).toMatchObject({ isValid: false, error: /timestamp/ });
    expect(validateWorkoutLog({ ...validLog, sets: -1 })).toMatchObject({ isValid: false, error: /sets/ });
  });

  it('should return invalid for non-numeric weight/reps', () => {
    expect(validateWorkoutLog({ ...validLog, weight: '100' as any })).toMatchObject({ isValid: false, error: /weight/ });
  });

  it('should return invalid for long notes', () => {
    expect(validateWorkoutLog({ ...validLog, notes: 'a'.repeat(1001) })).toMatchObject({ isValid: false, error: /notes/ });
  });
});
