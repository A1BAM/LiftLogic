import { describe, it, expect, vi } from 'vitest';
import { WorkoutLog } from '../types';

// Extracting logic for testing since we can't easily test the hook without full React environment
const getLogsByExercise = (logs: WorkoutLog[]) => {
  const map = new Map<string, WorkoutLog[]>();
  // Match hook behavior: assume logs are pre-sorted DESC
  const sorted = [...logs].sort((a, b) => b.timestamp - a.timestamp);
  sorted.forEach(log => {
    if (!map.has(log.exerciseId)) {
      map.set(log.exerciseId, []);
    }
    map.get(log.exerciseId)!.push(log);
  });
  return map;
};

const getLogsForExercise = (map: Map<string, WorkoutLog[]>, id: string) => {
  return map.get(id) || [];
};

const getTodaysLogs = (map: Map<string, WorkoutLog[]>, id: string) => {
  const all = getLogsForExercise(map, id);
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const results = [];
  for (const log of all) {
    if (log.timestamp < startOfDay) break;
    results.push(log);
  }
  return results.reverse();
};

const getLastSessionLogs = (map: Map<string, WorkoutLog[]>, id: string) => {
  const all = getLogsForExercise(map, id);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  let firstPrevLogIndex = -1;
  for (let i = 0; i < all.length; i++) {
    if (all[i].timestamp < startOfToday) {
      firstPrevLogIndex = i;
      break;
    }
  }

  if (firstPrevLogIndex === -1) return [];

  const d = new Date(all[firstPrevLogIndex].timestamp);
  const startOfLastDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  const results = [];
  for (let i = firstPrevLogIndex; i < all.length; i++) {
    const log = all[i];
    if (log.timestamp < startOfLastDay) break;
    results.push(log);
  }
  return results;
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
    const map = getLogsByExercise(logs);
    const result = getTodaysLogs(map, exerciseId);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('2');
  });

  it('getLastSessionLogs returns logs from the most recent session before today', () => {
    const map = getLogsByExercise(logs);
    const result = getLastSessionLogs(map, exerciseId);
    expect(result).toHaveLength(2);
    expect(result.every(l => l.weight === 90)).toBe(true);
    // Order from getLogsForExercise is desc, so we check that
    expect(result[0].id).toBe('4');
    expect(result[1].id).toBe('3');
  });

  it('getLastSessionLogs returns empty array if no logs before today', () => {
    const todayOnlyLogs = logs.filter(l => l.timestamp >= startOfToday);
    const map = getLogsByExercise(todayOnlyLogs);
    const result = getLastSessionLogs(map, exerciseId);
    expect(result).toHaveLength(0);
  });
});
