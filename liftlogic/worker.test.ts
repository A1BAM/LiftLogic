
import { describe, it, expect, vi, afterEach } from 'vitest';
import worker from './worker';

const { mockQuery } = vi.hoisted(() => {
  return { mockQuery: vi.fn().mockResolvedValue({ rows: [] }) };
});

// Mock Neon Database Pool
vi.mock('@neondatabase/serverless', () => {
  return {
    Pool: class {
      query = mockQuery;
      end = vi.fn().mockResolvedValue(undefined);
    }
  };
});

describe('Worker', () => {
  const createRequest = (method: string, url: string, body?: any, targetHash?: string) => {
    return new Request(url, {
      method,
      headers: new Headers({
        'Content-Type': 'application/json',
        ...(targetHash ? { 'Authorization': `Bearer ${targetHash}` } : {})
      }),
      body: body ? JSON.stringify(body) : undefined
    });
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('CORS and Security Headers', () => {
    it('handles OPTIONS preflight request', async () => {
      const request = createRequest('OPTIONS', 'http://localhost/gym-api');
      const env = { DATABASE_URL: 'dummy', ALLOWED_ORIGIN: '*' as any, ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, DELETE, OPTIONS');
    });

    it('reflects origin if in ALLOWED_ORIGIN whitelist', async () => {
      const request = new Request('http://localhost/gym-api', {
        headers: new Headers({ 'Origin': 'https://liftlogic.app' })
      });
      const env = { DATABASE_URL: 'dummy', ALLOWED_ORIGIN: 'https://liftlogic.app,http://localhost:3000' as any, ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://liftlogic.app');
    });
  });

  describe('Authentication', () => {
    it('returns 401 if TARGET_HASH is set and auth header is missing', async () => {
      const request = createRequest('GET', 'http://localhost/gym-api');
      const env = { DATABASE_URL: 'dummy', TARGET_HASH: 'mysecret', ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);

      expect(response.status).toBe(401);
      const data = await response.json() as any;
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('GET Requests', () => {
    it('returns empty array if dummy database URL is used and fetch fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Connection failed'));

      const request = createRequest('GET', 'http://localhost/gym-api');
      const env = { DATABASE_URL: 'postgres://dummy:dummy@localhost:5432/dummy', ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual([]);
    });

    it('returns fetched rows successfully', async () => {
      const mockRows = [
        { id: '1', exercise_id: 'ex1', timestamp: 123, weight: 100, reps: 10, sets: 1, notes: null }
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockRows });

      const request = createRequest('GET', 'http://localhost/gym-api');
      const env = { DATABASE_URL: 'real', ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);

      expect(response.status).toBe(200);
    });
  });

  describe('POST Bulk Requests (Validation)', () => {
    it('returns 400 for non-array payload', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api/bulk', { id: '1' });
      const env = { DATABASE_URL: 'real', ASSETS: { fetch: vi.fn() } as any };
      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('Invalid payload: must be an array');
    });

    it('returns 400 for invalid item in array', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api/bulk', [{ id: '' }]);
      const env = { DATABASE_URL: 'real', ASSETS: { fetch: vi.fn() } as any };
      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('Invalid id in array');
    });

    it('successfully processes a valid bulk payload', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const items = [
        { id: '1', exerciseId: 'ex1', timestamp: 123, weight: 100, reps: 10 },
        { id: '2', exerciseId: 'ex2', timestamp: 124, weight: 150, reps: 5 }
      ];
      const request = createRequest('POST', 'http://localhost/gym-api/bulk', items);
      const env = { DATABASE_URL: 'real', ASSETS: { fetch: vi.fn() } as any };
      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.success).toBe(true);
      expect(data.count).toBe(2);
      expect(mockQuery).toHaveBeenCalled();
    });

    it('returns 400 if bulk payload exceeds 10,000 items', async () => {
      const items = Array(10001).fill({ id: '1', exerciseId: 'ex1', timestamp: 123, weight: 100, reps: 10 });
      const request = createRequest('POST', 'http://localhost/gym-api/bulk', items);
      const env = { DATABASE_URL: 'real', ASSETS: { fetch: vi.fn() } as any };
      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('Payload too large: max 10,000 items');
    });
  });


  describe('POST Requests (Validation)', () => {

    it('returns 400 for invalid id', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api', {
        id: '', exerciseId: 'ex1', timestamp: 123, weight: 100, reps: 10
      });
      const env = { DATABASE_URL: 'real', ASSETS: { fetch: vi.fn() } as any };
      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('Invalid id');
    });

    it('returns 400 for invalid timestamp', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api', {
        id: '1', exerciseId: 'ex1', timestamp: -10, weight: 100, reps: 10
      });
      const env = { DATABASE_URL: 'real', ASSETS: { fetch: vi.fn() } as any };
      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('Invalid timestamp');
    });

    it('returns 400 for invalid weight (NaN)', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api', {
        id: '1', exerciseId: 'ex1', timestamp: 123, weight: NaN, reps: 10
      });
      const env = { DATABASE_URL: 'real', ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid weight' });
    });

    it('returns 400 for weight > 2000', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api', {
        id: '1', exerciseId: 'ex1', timestamp: 123, weight: 2001, reps: 10
      });
      const env = { DATABASE_URL: 'real', ASSETS: { fetch: vi.fn() } as any };
      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid weight' });
    });

    it('returns 400 for reps > 1000', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api', {
        id: '1', exerciseId: 'ex1', timestamp: 123, weight: 100, reps: 1001
      });
      const env = { DATABASE_URL: 'real', ASSETS: { fetch: vi.fn() } as any };
      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid reps' });
    });

    it('returns 400 for sets > 100', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api', {
        id: '1', exerciseId: 'ex1', timestamp: 123, weight: 100, reps: 10, sets: 101
      });
      const env = { DATABASE_URL: 'real', ASSETS: { fetch: vi.fn() } as any };
      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid sets' });
    });

    it('returns 400 if items array exceeds 10,000 items', async () => {
      const items = Array(10001).fill({ id: '1', exerciseId: 'ex1', timestamp: 123, weight: 100, reps: 10 });
      const request = createRequest('POST', 'http://localhost/gym-api', items);
      const env = { DATABASE_URL: 'real', ASSETS: { fetch: vi.fn() } as any };
      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('Payload too large: max 10,000 items');
    });
  });

  describe('Profile Requests', () => {
    it('returns 400 for invalid heightCm (> 300)', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api/profile', {
        heightCm: 301, weightLbs: 150
      });
      const env = { DATABASE_URL: 'real', ASSETS: { fetch: vi.fn() } as any };
      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid heightCm' });
    });

    it('returns 400 for invalid weightLbs (> 1000)', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api/profile', {
        heightCm: 180, weightLbs: 1001
      });
      const env = { DATABASE_URL: 'real', ASSETS: { fetch: vi.fn() } as any };
      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid weightLbs' });
    });

    it('returns 400 for invalid age (< 0)', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api/profile', {
        heightCm: 180, weightLbs: 150, age: -1
      });
      const env = { DATABASE_URL: 'real', ASSETS: { fetch: vi.fn() } as any };
      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid age' });
    });

    it('returns 400 for invalid age (> 150)', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api/profile', {
        heightCm: 180, weightLbs: 150, age: 151
      });
      const env = { DATABASE_URL: 'real', ASSETS: { fetch: vi.fn() } as any };
      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid age' });
    });

    it('returns 400 for invalid age (string)', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api/profile', {
        heightCm: 180, weightLbs: 150, age: '30'
      });
      const env = { DATABASE_URL: 'real', ASSETS: { fetch: vi.fn() } as any };
      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid age' });
    });

    it('successfully saves profile with valid age', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api/profile', {
        heightCm: 180, weightLbs: 150, age: 30
      });
      const env = { DATABASE_URL: 'real', ASSETS: { fetch: vi.fn() } as any };
      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
    });
  });

  describe('DELETE Requests', () => {
    it('returns 400 if body is empty', async () => {
      const request = createRequest('DELETE', 'http://localhost/gym-api', {});
      const env = { DATABASE_URL: 'real', ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('Missing ID or Exercise ID');
    });

    it('returns 400 if exerciseId is invalid', async () => {
      const request = createRequest('DELETE', 'http://localhost/gym-api', { exerciseId: '' });
      const env = { DATABASE_URL: 'real', ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('Invalid exerciseId');
    });

    it('returns 400 if id is invalid', async () => {
      const request = createRequest('DELETE', 'http://localhost/gym-api', { id: '' });
      const env = { DATABASE_URL: 'real', ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid id' });
    });
  });

  describe('Error Handling', () => {
    it('returns 500 without leaking DB details on generic error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Super secret DB credentials failed'));

      const request = createRequest('GET', 'http://localhost/gym-api');
      const env = { DATABASE_URL: 'real', ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'Internal Server Error' });
    });
  });
});
