import { describe, it, expect, vi } from 'vitest';
import worker from './worker';

const { mockQuery } = vi.hoisted(() => {
  return {
    mockQuery: vi.fn().mockImplementation(async (query: string) => {
      if (query.includes('ALTER TABLE')) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return { rows: [] };
    })
  };
});

vi.mock('@neondatabase/serverless', () => {
  return {
    Pool: class {
      query = mockQuery;
      end = vi.fn().mockResolvedValue(undefined);
    }
  };
});

describe('Profile Insert Benchmark', () => {
  const env = { DATABASE_URL: 'dummy', TARGET_HASH: 'testsecret', ASSETS: { fetch: vi.fn() } as any };

  it('measures profile insert overhead with and without schema modification', async () => {
    const headers = new Headers();
    headers.set('Cookie', 'liftlogic_auth_token=testsecret');
    headers.set('Content-Type', 'application/json');

    const start = performance.now();
    const request = new Request('http://localhost/gym-api/profile', {
      method: 'POST',
      headers,
      body: JSON.stringify({ heightCm: 180, weightLbs: 150, age: 30 })
    });

    await worker.fetch(request, env, {} as any);
    const time = performance.now() - start;

    console.log(`Profile POST API call time: ${time.toFixed(2)}ms`);
  });
});
