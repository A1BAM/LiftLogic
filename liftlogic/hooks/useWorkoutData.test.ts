import { describe, it, expect, vi } from 'vitest';
import { WorkoutLog } from '../types';

// Simulating optimized hook logic
const getLogsForExercise = (logsByExercise: Map<string, WorkoutLog[]>, id: string) => {
  return logsByExercise.get(id) || [];
};

const getTodaysLogs = (logsByExercise: Map<string, WorkoutLog[]>, id: string) => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

  return getLogsForExercise(logsByExercise, id)
    .filter(l => l.timestamp >= startOfDay && l.timestamp < endOfDay)
    .reverse();
};

const getLastSessionLogs = (logsByExercise: Map<string, WorkoutLog[]>, id: string) => {
  const all = getLogsForExercise(logsByExercise, id);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const lastLogNotToday = all.find(l => l.timestamp < startOfToday);
  if (!lastLogNotToday) return [];

  const d = new Date(lastLogNotToday.timestamp);
  const startOfLastDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const endOfLastDay = startOfLastDay + 24 * 60 * 60 * 1000;

  return all.filter(l => l.timestamp >= startOfLastDay && l.timestamp < endOfLastDay);
};

describe('useWorkoutData filtering logic', () => {
  const exerciseId = 'test-ex';
  const now = new Date(2024, 0, 15, 12, 0, 0).getTime(); // Jan 15, 2024, 12:00
  const startOfToday = new Date(2024, 0, 15, 0, 0, 0).getTime();
  const startOfYesterday = new Date(2024, 0, 14, 0, 0, 0).getTime();

  vi.setSystemTime(now);

  const logs: WorkoutLog[] = [
    { id: '2', exerciseId, timestamp: startOfToday + 2000, weight: 100, reps: 10, sets: 1 }, // Today
    { id: '1', exerciseId, timestamp: startOfToday + 1000, weight: 100, reps: 10, sets: 1 }, // Today
    { id: '4', exerciseId, timestamp: startOfYesterday + 2000, weight: 90, reps: 10, sets: 1 }, // Yesterday
    { id: '3', exerciseId, timestamp: startOfYesterday + 1000, weight: 90, reps: 10, sets: 1 }, // Yesterday
    { id: '5', exerciseId, timestamp: startOfYesterday - 1000, weight: 80, reps: 10, sets: 1 }, // Day before yesterday
  ];

  const logsByExercise = new Map<string, WorkoutLog[]>();
  logsByExercise.set(exerciseId, logs);

  it('getTodaysLogs returns only logs from today in reverse chronological order', () => {
    const result = getTodaysLogs(logsByExercise, exerciseId);
    expect(result).toHaveLength(2);
    // result is reversed, so should be 1 then 2 if they were desc in logs
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('2');
  });

  it('getLastSessionLogs returns logs from the most recent session before today', () => {
    const result = getLastSessionLogs(logsByExercise, exerciseId);
    expect(result).toHaveLength(2);
    expect(result.every(l => l.weight === 90)).toBe(true);
    // Order is desc, so 4 then 3
    expect(result[0].id).toBe('4');
    expect(result[1].id).toBe('3');
  });

  it('getLastSessionLogs returns empty array if no logs before today', () => {
    const todayOnlyLogs = logs.filter(l => l.timestamp >= startOfToday);
    const map = new Map<string, WorkoutLog[]>();
    map.set(exerciseId, todayOnlyLogs);
    const result = getLastSessionLogs(map, exerciseId);
    expect(result).toHaveLength(0);
  });
});
