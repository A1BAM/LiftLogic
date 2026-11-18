import { DayType, ExerciseDef } from '../types';

/**
 * Shared by the browser (restoring a backup) and the Worker (saving an
 * exercise), so the two can never disagree about what an exercise is.
 */

const DAYS: DayType[] = ['PUSH', 'PULL', 'LEGS'];

/**
 * An exercise from a file, or null if it is not one. Only known fields are
 * kept, and only within the limits the server enforces: the definition is
 * stored as JSON in a 500-character column under the id `def_<id>`.
 */
export function validateExercise(raw: unknown): ExerciseDef | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;
  const text = (v: unknown, max: number) =>
    typeof v === 'string' && v.trim() !== '' && v.length <= max ? v : null;

  const id = text(e.id, 46);
  const name = text(e.name, 80);
  const muscleGroup = text(e.muscleGroup, 80) ?? '';
  const dayType = DAYS.includes(e.dayType as DayType) ? (e.dayType as DayType) : null;
  const defaultWeight = Number(e.defaultWeight);
  const increment = Number(e.increment);
  const targetReps = Number(e.targetReps);
  if (!id || !name || !dayType) return null;
  if (!Number.isFinite(defaultWeight) || defaultWeight < 0 || defaultWeight > 2000) return null;
  if (!Number.isFinite(increment) || increment <= 0 || increment > 100) return null;
  if (!Number.isInteger(targetReps) || targetReps < 1 || targetReps > 100) return null;

  const ex: ExerciseDef = { id, name, muscleGroup, defaultWeight, increment, targetReps, dayType };
  if (e.isCustom === true) ex.isCustom = true;
  if (e.isArchived === true) ex.isArchived = true;
  if (e.isSlotChoice === true) ex.isSlotChoice = true;
  return JSON.stringify(ex).length <= 500 ? ex : null;
}
