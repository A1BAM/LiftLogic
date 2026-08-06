import { describe, it } from 'vitest';
import { WorkoutLog } from './types';

function legacyFormat(logs: WorkoutLog[]) {
  const results: string[] = [];
  for (const log of logs) {
    results.push(new Date(log.timestamp).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }));
  }
  return results;
}

const historyDateCache = new Map<string, string>();
const historyDateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short', month: 'short', day: 'numeric'
});

function optimizedFormat(logs: WorkoutLog[]) {
  const results: string[] = [];
  for (const log of logs) {
    const d = new Date(log.timestamp);
    const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    let dateStr = historyDateCache.get(dateKey);
    if (!dateStr) {
      dateStr = historyDateFormatter.format(log.timestamp);
      historyDateCache.set(dateKey, dateStr);
    }
    results.push(dateStr);
  }
  return results;
}

describe('History Date Formatting Benchmark', () => {
  it('measures legacy vs optimized history date formatting', () => {
    const numLogs = 1000;
    const baseTime = Date.now();
    const mockLogs: WorkoutLog[] = Array.from({ length: numLogs }).map((_, i) => ({
      id: `log_${i}`,
      exerciseId: 'bench-press',
      timestamp: baseTime - i * 3600 * 1000,
      weight: 135,
      reps: 10,
      sets: 1
    }));

    // Warm-up
    legacyFormat(mockLogs);
    optimizedFormat(mockLogs);

    // Measure Legacy
    const startLegacy = performance.now();
    for (let r = 0; r < 15; r++) {
      legacyFormat(mockLogs);
    }
    const timeLegacy = performance.now() - startLegacy;

    // Measure Optimized
    const startOptimized = performance.now();
    for (let r = 0; r < 15; r++) {
      optimizedFormat(mockLogs);
    }
    const timeOptimized = performance.now() - startOptimized;

    console.log(`Legacy history date formatting (15 iterations of 1k logs): ${timeLegacy.toFixed(2)}ms`);
    console.log(`Optimized history date formatting (15 iterations of 1k logs): ${timeOptimized.toFixed(2)}ms`);
    console.log(`Speedup: ${(timeLegacy / timeOptimized).toFixed(2)}x faster`);
  });
});
