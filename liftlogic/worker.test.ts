import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker from './worker';

// Mock Neon Database Pool
export const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
vi.mock('@neondatabase/serverless', () => {
  return {
    Pool: class {
      query = mockQuery;
      end = vi.fn().mockResolvedValue(undefined);
    }
  };
});

describe('Worker API Validation', () => {
  const env = {
    DATABASE_URL: 'postgres://dummy:dummy@localhost:5432/dummy',
    TARGET_HASH: 'test-hash',
    ASSETS: { fetch: vi.fn() }
  };

  const ctx = {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn()
  };

  const createRequest = (method: string, body: any = null, headers: any = {}) => {
    const options: any = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-hash',
        ...headers
      }
    };
    if (body !== null && method !== 'GET' && method !== 'HEAD') {
      options.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
    return new Request('http://localhost/gym-api', options);
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET Validation', () => {
    it('returns empty array when database error occurs with dummy connection string', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Simulated database error'));

      const request = createRequest('GET');
      const response = await worker.fetch(request, env as any, ctx as any);

      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data).toEqual([]);
    });

    it('throws error when database error occurs with real connection string', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Simulated database error'));

      const request = createRequest('GET');
      const realEnv = { ...env, DATABASE_URL: 'postgres://real:real@localhost:5432/real' };

      const response = await worker.fetch(request, realEnv as any, ctx as any);
      expect(response.status).toBe(500);
      const data = await response.json() as any;
      expect(data.error).toBe('Internal Server Error');
    });
  });

  describe('POST Validation', () => {
    it('returns 400 for malformed JSON', async () => {
      const request = createRequest('POST', '{"invalid": json');
      const response = await worker.fetch(request, env as any, ctx as any);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('Invalid JSON');
    });

    it('returns 400 for missing id', async () => {
      const request = createRequest('POST', { exerciseId: 'test', timestamp: Date.now(), weight: 10, reps: 5 });
      const response = await worker.fetch(request, env as any, ctx as any);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('Invalid id');
    });

    it('returns 400 for too long id', async () => {
        const request = createRequest('POST', { id: 'a'.repeat(51), exerciseId: 'test', timestamp: Date.now(), weight: 10, reps: 5 });
        const response = await worker.fetch(request, env as any, ctx as any);
        expect(response.status).toBe(400);
        const data = await response.json() as any;
        expect(data.error).toBe('Invalid id');
    });

    it('returns 400 for negative weight', async () => {
      const request = createRequest('POST', { id: '1', exerciseId: 'test', timestamp: Date.now(), weight: -1, reps: 5 });
      const response = await worker.fetch(request, env as any, ctx as any);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('Invalid weight');
    });

    it('returns 400 for invalid timestamp', async () => {
      const request = createRequest('POST', { id: '1', exerciseId: 'test', timestamp: 'not-a-number', weight: 10, reps: 5 });
      const response = await worker.fetch(request, env as any, ctx as any);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('Invalid timestamp');
    });

    it('returns 400 for too long notes', async () => {
      const request = createRequest('POST', { id: '1', exerciseId: 'test', timestamp: Date.now(), weight: 10, reps: 5, notes: 'a'.repeat(501) });
      const response = await worker.fetch(request, env as any, ctx as any);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('Invalid notes');
    });

    it('returns 200 for valid data', async () => {
      const request = createRequest('POST', { id: '1', exerciseId: 'test', timestamp: Date.now(), weight: 10, reps: 5, sets: 3, notes: 'Good set' });
      const response = await worker.fetch(request, env as any, ctx as any);
      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.success).toBe(true);
    });
  });

  describe('DELETE Validation', () => {
    it('returns 400 for missing both id and exerciseId', async () => {
      const request = createRequest('DELETE', {});
      const response = await worker.fetch(request, env as any, ctx as any);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('Missing ID or Exercise ID');
    });

    it('returns 400 for invalid exerciseId format', async () => {
      const request = createRequest('DELETE', { exerciseId: 123 });
      const response = await worker.fetch(request, env as any, ctx as any);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('Invalid exerciseId');
    });

    it('returns 200 for valid delete by id', async () => {
      const request = createRequest('DELETE', { id: 'test-id' });
      const response = await worker.fetch(request, env as any, ctx as any);
      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.success).toBe(true);
    });
  });
});
