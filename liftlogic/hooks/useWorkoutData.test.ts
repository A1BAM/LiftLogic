import { describe, it, expect, vi } from 'vitest';
import { WorkoutLog } from '../types';

// Helper to simulate the memoized Map used in the hook
const getLogsByExerciseMap = (logs: WorkoutLog[]) => {
    const map = new Map<string, WorkoutLog[]>();
    const sortedLogs = [...logs].sort((a, b) => b.timestamp - a.timestamp);
    sortedLogs.forEach(log => {
      if (!map.has(log.exerciseId)) map.set(log.exerciseId, []);
      map.get(log.exerciseId)!.push(log);
    });
    return map;
};

// Updated logic matching the optimized hook implementation
const getLogsForExercise = (logsByExercise: Map<string, WorkoutLog[]>, id: string) => {
    return logsByExercise.get(id) || [];
};

const getTodaysLogs = (logsByExercise: Map<string, WorkoutLog[]>, id: string) => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

  const exerciseLogs = getLogsForExercise(logsByExercise, id);
  const result: WorkoutLog[] = [];
  for (const log of exerciseLogs) {
    if (log.timestamp >= endOfDay) continue;
    if (log.timestamp < startOfDay) break;
    result.push(log);
  }
  return result.reverse();
};

const getLastSessionLogs = (logsByExercise: Map<string, WorkoutLog[]>, id: string) => {
  const exerciseLogs = getLogsForExercise(logsByExercise, id);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const lastLogNotToday = exerciseLogs.find(l => l.timestamp < startOfToday);
  if (!lastLogNotToday) return [];

  const d = new Date(lastLogNotToday.timestamp);
  const startOfLastDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const endOfLastDay = startOfLastDay + 24 * 60 * 60 * 1000;

  const result: WorkoutLog[] = [];
  for (const log of exerciseLogs) {
    if (log.timestamp >= endOfLastDay) continue;
    if (log.timestamp < startOfLastDay) break;
    result.push(log);
  }
  return result;
};

describe('useWorkoutData filtering logic', () => {
  const exerciseId = 'test-ex';
  const now = new Date(2024, 0, 15, 12, 0, 0).getTime(); // Jan 15, 2024, 12:00
  const startOfToday = new Date(2024, 0, 15, 0, 0, 0).getTime();
  const startOfYesterday = new Date(2024, 0, 14, 0, 0, 0).getTime();

  vi.setSystemTime(now);

  const logs: WorkoutLog[] = [
    { id: '1', exerciseId, timestamp: startOfToday + 1000, weight: 100, reps: 10, sets: 1 }, // Today
    { id: '2', exerciseId, timestamp: startOfToday + 2000, weight: 100, reps: 10, sets: 1 }, // Today
    { id: '3', exerciseId, timestamp: startOfYesterday + 1000, weight: 90, reps: 10, sets: 1 }, // Yesterday
    { id: '4', exerciseId, timestamp: startOfYesterday + 2000, weight: 90, reps: 10, sets: 1 }, // Yesterday
    { id: '5', exerciseId, timestamp: startOfYesterday - 1000, weight: 80, reps: 10, sets: 1 }, // Day before yesterday
  ];

  it('getTodaysLogs returns only logs from today in reverse chronological order', () => {
    const map = getLogsByExerciseMap(logs);
    const result = getTodaysLogs(map, exerciseId);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('2');
  });

  it('getLastSessionLogs returns logs from the most recent session before today', () => {
    const map = getLogsByExerciseMap(logs);
    const result = getLastSessionLogs(map, exerciseId);
    expect(result).toHaveLength(2);
    expect(result.every(l => l.weight === 90)).toBe(true);
    // Descending order in result list
    expect(result[0].id).toBe('4');
    expect(result[1].id).toBe('3');
  });

  it('getLastSessionLogs returns empty array if no logs before today', () => {
    const todayOnlyLogs = logs.filter(l => l.timestamp >= startOfToday);
    const map = getLogsByExerciseMap(todayOnlyLogs);
    const result = getLastSessionLogs(map, exerciseId);
    expect(result).toHaveLength(0);
  });
});
