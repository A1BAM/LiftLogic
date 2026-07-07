import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import worker from './worker';

const { mockQuery } = vi.hoisted(() => {
  return { mockQuery: vi.fn().mockResolvedValue({ rows: [] }) };
});

vi.mock('@neondatabase/serverless', () => {
  return {
    Pool: class {
      query = mockQuery;
      end = vi.fn().mockResolvedValue(undefined);
    }
  };
});

describe('Bulk Insert Benchmark', () => {
  const env = { DATABASE_URL: 'dummy', ASSETS: { fetch: vi.fn() } as any };

  it('measures sequential/Promise.all vs bulk insert overhead', async () => {
    const numItems = 500;
    const items = Array.from({ length: numItems }).map((_, i) => ({
      id: `id_${i}`,
      exerciseId: 'ex1',
      timestamp: Date.now(),
      weight: 100,
      reps: 10
    }));

    // Measure Promise.all N individual requests
    const startN = performance.now();
    await Promise.all(items.map(item => {
      const request = new Request('http://localhost/gym-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
      return worker.fetch(request, env, {} as any);
    }));
    const timeN = performance.now() - startN;

    // Measure Bulk request
    const startBulk = performance.now();
    const bulkRequest = new Request('http://localhost/gym-api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(items)
    });
    // Assuming worker.ts will be updated to handle bulk
    await worker.fetch(bulkRequest, env, {} as any);
    const timeBulk = performance.now() - startBulk;

    console.log(`N+1 API calls time for ${numItems} items: ${timeN.toFixed(2)}ms`);
    console.log(`Bulk API call time for ${numItems} items: ${timeBulk.toFixed(2)}ms`);
    console.log(`Improvement: ${(timeN / timeBulk).toFixed(2)}x faster`);

    // We expect timeN to be longer than timeBulk once implemented!
  });
});
