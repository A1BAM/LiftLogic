/**
 * Security validation utilities for the LiftLogic API
 */

export const validateId = (id: any): boolean => {
  return typeof id === 'string' && id.length > 0 && id.length <= 100;
};

export const validateNote = (note: any): boolean => {
  if (note === null || note === undefined) return true;
  return typeof note === 'string' && note.length <= 1000;
};

export const validateNonNegativeNumber = (num: any): boolean => {
  return typeof num === 'number' && !isNaN(num) && num >= 0;
};

export const validateWorkoutPayload = (payload: any): { isValid: boolean; error?: string } => {
  if (!payload || typeof payload !== 'object') {
    return { isValid: false, error: "Invalid payload" };
  }

  const { id, exerciseId, timestamp, weight, reps, sets, notes } = payload;

  if (!validateId(id)) return { isValid: false, error: "Invalid ID" };
  if (!validateId(exerciseId)) return { isValid: false, error: "Invalid Exercise ID" };
  if (!validateNonNegativeNumber(timestamp)) return { isValid: false, error: "Invalid timestamp" };
  if (!validateNonNegativeNumber(weight)) return { isValid: false, error: "Invalid weight" };
  if (!validateNonNegativeNumber(reps)) return { isValid: false, error: "Invalid reps" };
  if (sets !== undefined && !validateNonNegativeNumber(sets)) return { isValid: false, error: "Invalid sets" };
  if (!validateNote(notes)) return { isValid: false, error: "Note too long" };

  return { isValid: true };
};
