import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker from './worker';

vi.mock('@neondatabase/serverless', () => ({
  Pool: class {
    query = vi.fn().mockResolvedValue({ rows: [] });
    end = vi.fn().mockResolvedValue(undefined);
  }
}));

vi.mock('./utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('worker security and validation', () => {
  const env = {
    DATABASE_URL: 'postgres://user:pass@localhost/db',
    TARGET_HASH: 'testhash',
    ASSETS: { fetch: vi.fn() }
  };
  const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as any;
  const authHeader = { 'Authorization': 'Bearer testhash', 'Content-Type': 'application/json' };

  it('returns 400 for invalid JSON', async () => {
    const request = new Request('http://localhost/gym-api', {
      method: 'POST',
      headers: authHeader,
      body: 'invalid-json'
    });

    const response = await worker.fetch(request, env, ctx);
    expect(response.status).toBe(400);
    const data = await response.json() as any;
    expect(data.error).toBe('Invalid JSON');
  });

  it('returns 401 for unauthorized requests', async () => {
    const request = new Request('http://localhost/gym-api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: '1' })
    });

    const response = await worker.fetch(request, env, ctx);
    expect(response.status).toBe(401);
  });

  describe('POST validation', () => {
    it('returns 400 for missing ID', async () => {
      const request = new Request('http://localhost/gym-api', {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({ exerciseId: 'ex1', timestamp: Date.now(), weight: 10, reps: 10 })
      });

      const response = await worker.fetch(request, env, ctx);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toContain('ID/Exercise ID');
    });

    it('returns 400 for too long ID', async () => {
      const request = new Request('http://localhost/gym-api', {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({ id: 'a'.repeat(51), exerciseId: 'ex1', timestamp: Date.now(), weight: 10, reps: 10 })
      });

      const response = await worker.fetch(request, env, ctx);
      expect(response.status).toBe(400);
    });

    it('returns 400 for invalid timestamp', async () => {
      const request = new Request('http://localhost/gym-api', {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({ id: '1', exerciseId: 'ex1', timestamp: -1, weight: 10, reps: 10 })
      });

      const response = await worker.fetch(request, env, ctx);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('Invalid timestamp');
    });

    it('returns 400 for negative weight', async () => {
      const request = new Request('http://localhost/gym-api', {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({ id: '1', exerciseId: 'ex1', timestamp: Date.now(), weight: -5, reps: 10 })
      });

      const response = await worker.fetch(request, env, ctx);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('Invalid weight, reps, or sets');
    });

    it('returns 400 for too long notes', async () => {
      const request = new Request('http://localhost/gym-api', {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({
          id: '1',
          exerciseId: 'ex1',
          timestamp: Date.now(),
          weight: 10,
          reps: 10,
          notes: 'a'.repeat(501)
        })
      });

      const response = await worker.fetch(request, env, ctx);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('Notes too long or invalid');
    });
  });

  describe('DELETE validation', () => {
    it('returns 400 for missing both id and exerciseId', async () => {
      const request = new Request('http://localhost/gym-api', {
        method: 'DELETE',
        headers: authHeader,
        body: JSON.stringify({})
      });

      const response = await worker.fetch(request, env, ctx);
      expect(response.status).toBe(400);
    });

    it('returns 200 for valid id', async () => {
      const request = new Request('http://localhost/gym-api', {
        method: 'DELETE',
        headers: authHeader,
        body: JSON.stringify({ id: '1' })
      });

      const response = await worker.fetch(request, env, ctx);
      expect(response.status).toBe(200);
    });

    it('returns 400 for invalid id type', async () => {
      const request = new Request('http://localhost/gym-api', {
        method: 'DELETE',
        headers: authHeader,
        body: JSON.stringify({ id: 123 })
      });

      const response = await worker.fetch(request, env, ctx);
      expect(response.status).toBe(400);
    });
  });
});
