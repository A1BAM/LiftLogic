export const validateWorkoutLog = (data: any): { valid: boolean; error?: string } => {
  if (!data || typeof data !== 'object') return { valid: false, error: 'Invalid payload' };

  const { id, exerciseId, timestamp, weight, reps, sets, notes } = data;

  if (typeof id !== 'string' || id.length === 0 || id.length > 100) {
    return { valid: false, error: 'Invalid ID' };
  }

  if (typeof exerciseId !== 'string' || exerciseId.length === 0 || exerciseId.length > 100) {
    return { valid: false, error: 'Invalid Exercise ID' };
  }

  if (typeof timestamp !== 'number' || timestamp < 0) {
    return { valid: false, error: 'Invalid Timestamp' };
  }

  if (typeof weight !== 'number' || weight < 0) {
    return { valid: false, error: 'Invalid Weight' };
  }

  if (typeof reps !== 'number' || reps < 0) {
    return { valid: false, error: 'Invalid Reps' };
  }

  if (typeof sets !== 'number' || sets < 0) {
    return { valid: false, error: 'Invalid Sets' };
  }

  if (notes !== undefined && notes !== null && (typeof notes !== 'string' || notes.length > 1000)) {
    return { valid: false, error: 'Invalid Notes' };
  }

  return { valid: true };
};

export const validateDeleteRequest = (data: any): { valid: boolean; error?: string } => {
  if (!data || typeof data !== 'object') return { valid: false, error: 'Invalid payload' };

  const { id, exerciseId } = data;

  if (!id && !exerciseId) {
    return { valid: false, error: 'Missing ID or Exercise ID' };
  }

  if (id && (typeof id !== 'string' || id.length > 100)) {
    return { valid: false, error: 'Invalid ID' };
  }

  if (exerciseId && (typeof exerciseId !== 'string' || exerciseId.length > 100)) {
    return { valid: false, error: 'Invalid Exercise ID' };
  }

  return { valid: true };
};
