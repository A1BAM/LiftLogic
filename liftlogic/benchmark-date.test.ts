import { describe, it } from 'vitest';
import { WorkoutLog } from './types';

// Legacy session parsing with Date instantiations
function legacySessions(exerciseLogs: WorkoutLog[]) {
  const sessionsArr: { date: string; logs: WorkoutLog[] }[] = [];
  let currentDayStart = -1;
  let currentSession: { date: string; logs: WorkoutLog[] } | null = null;

  for (const log of exerciseLogs) {
    if (log.timestamp < currentDayStart || !currentSession) {
      const d = new Date(log.timestamp);
      currentSession = { date: d.toDateString(), logs: [] };
      sessionsArr.push(currentSession);

      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      currentDayStart = startOfDay.getTime();
    }
    currentSession.logs.push(log);
  }
  return sessionsArr;
}

// Optimized session parsing with cache and timezone offset math (DST-safe)
const testCache = new Map<number, string>();

function optimizedSessions(exerciseLogs: WorkoutLog[]) {
  const sessionsArr: { date: string; logs: WorkoutLog[] }[] = [];
  let currentDayStart = -1;
  let currentSession: { date: string; logs: WorkoutLog[] } | null = null;

  for (const log of exerciseLogs) {
    if (log.timestamp < currentDayStart || !currentSession) {
      const d = new Date(log.timestamp);
      const localOffsetMs = d.getTimezoneOffset() * 60000;
      const dayId = Math.floor((log.timestamp - localOffsetMs) / 86400000);
      let dateStr = testCache.get(dayId);
      if (!dateStr) {
        dateStr = d.toDateString();
        testCache.set(dayId, dateStr);
      }

      currentSession = { date: dateStr, logs: [] };
      sessionsArr.push(currentSession);

      currentDayStart = dayId * 86400000 + localOffsetMs;
    }
    currentSession.logs.push(log);
  }
  return sessionsArr;
}

describe('Date Allocation Benchmark', () => {
  it('measures legacy vs optimized sessions grouping', () => {
    const numLogs = 5000;
    const baseTime = Date.now();
    const mockLogs: WorkoutLog[] = Array.from({ length: numLogs }).map((_, i) => ({
      id: `log_${i}`,
      exerciseId: 'bench-press',
      timestamp: baseTime - i * 3600 * 1000, // spaced out by 1 hour (various days)
      weight: 135,
      reps: 10,
      sets: 1
    }));

    // Warm-up
    legacySessions(mockLogs);
    optimizedSessions(mockLogs);

    // Measure Legacy
    const startLegacy = performance.now();
    for (let r = 0; r < 20; r++) {
      legacySessions(mockLogs);
    }
    const timeLegacy = performance.now() - startLegacy;

    // Measure Optimized
    const startOptimized = performance.now();
    for (let r = 0; r < 20; r++) {
      optimizedSessions(mockLogs);
    }
    const timeOptimized = performance.now() - startOptimized;

    console.log(`Legacy sessions grouping (20 iterations of 5k logs): ${timeLegacy.toFixed(2)}ms`);
    console.log(`Optimized sessions grouping (20 iterations of 5k logs): ${timeOptimized.toFixed(2)}ms`);
    console.log(`Speedup: ${(timeLegacy / timeOptimized).toFixed(2)}x faster`);
  });
});
