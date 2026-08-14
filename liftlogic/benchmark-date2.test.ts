import { describe, it } from 'vitest';
import { WorkoutLog } from './types';
import { legacySessions, optimizedSessions, moreOptimizedSessions } from './benchmark-utils';


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
    moreOptimizedSessions(mockLogs);

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

    // Measure More Optimized
    const startMoreOptimized = performance.now();
    for (let r = 0; r < 20; r++) {
      moreOptimizedSessions(mockLogs);
    }
    const timeMoreOptimized = performance.now() - startMoreOptimized;

    console.log(`Legacy: ${timeLegacy.toFixed(2)}ms`);
    console.log(`Optimized: ${timeOptimized.toFixed(2)}ms`);
    console.log(`More Optimized: ${timeMoreOptimized.toFixed(2)}ms`);
    console.log(`Speedup Legacy -> Optimized: ${(timeLegacy / timeOptimized).toFixed(2)}x`);
    console.log(`Speedup Optimized -> More Optimized: ${(timeOptimized / timeMoreOptimized).toFixed(2)}x`);
  });
});
