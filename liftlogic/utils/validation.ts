export interface WorkoutPayload {
  id?: string;
  exerciseId?: string;
  timestamp?: number;
  weight?: number;
  reps?: number;
  sets?: number;
  notes?: string | null;
}

export function validateWorkoutPayload(payload: any): string | null {
  if (!payload || typeof payload !== 'object') {
    return "Invalid payload format";
  }

  const { id, exerciseId, timestamp, weight, reps, sets, notes } = payload;

  // IDs: Required for POST, must be non-empty strings <= 100 chars
  if (typeof id !== 'undefined') {
    if (typeof id !== 'string' || id.length === 0 || id.length > 100) {
      return "Invalid ID: must be a string between 1 and 100 characters";
    }
  }

  if (typeof exerciseId !== 'undefined') {
    if (typeof exerciseId !== 'string' || exerciseId.length === 0 || exerciseId.length > 100) {
      return "Invalid Exercise ID: must be a string between 1 and 100 characters";
    }
  }

  // Numeric fields: must be non-negative numbers
  const numericFields = { timestamp, weight, reps, sets };
  for (const [key, value] of Object.entries(numericFields)) {
    if (typeof value !== 'undefined' && value !== null) {
      if (typeof value !== 'number' || value < 0 || !Number.isFinite(value)) {
        return `Invalid ${key}: must be a non-negative number`;
      }
    }
  }

  // Notes: must be a string <= 1000 chars
  if (typeof notes !== 'undefined' && notes !== null) {
    if (typeof notes !== 'string' || notes.length > 1000) {
      return "Invalid notes: must be a string up to 1000 characters";
    }
  }

  return null;
}
