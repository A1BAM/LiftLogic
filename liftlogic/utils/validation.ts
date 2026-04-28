/**
 * Validates workout data fields to ensure they meet security and data integrity requirements.
 */

export const validateId = (id: any): boolean => {
  return typeof id === 'string' && id.length > 0 && id.length <= 100;
};

export const validateExerciseId = (exerciseId: any): boolean => {
  return typeof exerciseId === 'string' && exerciseId.length > 0 && exerciseId.length <= 100;
};

export const validateNotes = (notes: any): boolean => {
  if (notes === undefined || notes === null) return true;
  return typeof notes === 'string' && notes.length <= 1000;
};

export const validateNonNegativeNumber = (value: any): boolean => {
  return typeof value === 'number' && !isNaN(value) && value >= 0;
};

export interface WorkoutData {
  id?: any;
  exerciseId?: any;
  timestamp?: any;
  weight?: any;
  reps?: any;
  sets?: any;
  notes?: any;
}

export const validateWorkoutLog = (data: WorkoutData): { isValid: boolean; error?: string } => {
  if (!validateId(data.id)) return { isValid: false, error: "Invalid or missing ID" };
  if (!validateExerciseId(data.exerciseId)) return { isValid: false, error: "Invalid or missing Exercise ID" };
  if (!validateNonNegativeNumber(data.timestamp)) return { isValid: false, error: "Invalid or missing timestamp" };
  if (!validateNonNegativeNumber(data.weight)) return { isValid: false, error: "Invalid or missing weight" };
  if (!validateNonNegativeNumber(data.reps)) return { isValid: false, error: "Invalid or missing reps" };
  if (data.sets !== undefined && !validateNonNegativeNumber(data.sets)) return { isValid: false, error: "Invalid sets" };
  if (!validateNotes(data.notes)) return { isValid: false, error: "Invalid notes" };

  return { isValid: true };
};
