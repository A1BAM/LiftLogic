export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export const validateWorkoutLog = (data: any): ValidationResult => {
  const { id, exerciseId, timestamp, weight, reps, sets, notes } = data || {};

  if (!id || typeof id !== 'string' || id.length > 100) {
    return { isValid: false, error: 'Invalid or missing ID' };
  }

  if (!exerciseId || typeof exerciseId !== 'string' || exerciseId.length > 100) {
    return { isValid: false, error: 'Invalid or missing exerciseId' };
  }

  if (typeof timestamp !== 'number' || timestamp < 0) {
    return { isValid: false, error: 'Invalid timestamp' };
  }

  if (typeof weight !== 'number' || weight < 0) {
    return { isValid: false, error: 'Invalid weight' };
  }

  if (typeof reps !== 'number' || reps < 0) {
    return { isValid: false, error: 'Invalid reps' };
  }

  if (sets !== undefined && (typeof sets !== 'number' || sets < 0)) {
    return { isValid: false, error: 'Invalid sets' };
  }

  if (notes !== undefined && notes !== null) {
    if (typeof notes !== 'string' || notes.length > 1000) {
      return { isValid: false, error: 'Invalid notes' };
    }
  }

  return { isValid: true };
};

export const validateDeleteRequest = (data: any): ValidationResult => {
  const { id, exerciseId } = data || {};

  if (!id && !exerciseId) {
    return { isValid: false, error: 'Missing ID or exerciseId' };
  }

  if (id && (typeof id !== 'string' || id.length > 100)) {
    return { isValid: false, error: 'Invalid ID' };
  }

  if (exerciseId && (typeof exerciseId !== 'string' || exerciseId.length > 100)) {
    return { isValid: false, error: 'Invalid exerciseId' };
  }

  return { isValid: true };
};
