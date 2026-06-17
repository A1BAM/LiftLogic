import { describe, it, expect, vi } from 'vitest';
import worker from './worker';

// Mock Neon Pool as a class to avoid constructor errors
vi.mock('@neondatabase/serverless', () => {
  return {
    Pool: class {
      query = vi.fn().mockResolvedValue({ rows: [] });
      end = vi.fn().mockResolvedValue(undefined);
    },
  };
});

describe('Worker CORS', () => {
  const env = {
    DATABASE_URL: 'postgres://localhost/test',
    ALLOWED_ORIGIN: '*',
    ASSETS: { fetch: vi.fn() }
  } as any;

  it('should return * literal when ALLOWED_ORIGIN is * (SECURE BEHAVIOR)', async () => {
    const request = new Request('https://api.example.com/gym-api', {
      headers: { 'Origin': 'https://malicious.com' }
    });

    const response = await worker.fetch(request, env, {} as any);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('should allow exact match of ALLOWED_ORIGIN', async () => {
    const localEnv = { ...env, ALLOWED_ORIGIN: 'https://trusted.com' };
    const request = new Request('https://api.example.com/gym-api', {
      headers: { 'Origin': 'https://trusted.com' }
    });

    const response = await worker.fetch(request, localEnv, {} as any);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://trusted.com');
  });

  it('should return default allowed origin if it does not match', async () => {
    const localEnv = { ...env, ALLOWED_ORIGIN: 'https://trusted.com' };
    const request = new Request('https://api.example.com/gym-api', {
      headers: { 'Origin': 'https://untrusted.com' }
    });

    const response = await worker.fetch(request, localEnv, {} as any);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://trusted.com');
  });

  it('should support multiple origins', async () => {
    const localEnv = { ...env, ALLOWED_ORIGIN: 'https://a.com, https://b.com' };

    const reqA = new Request('https://api.example.com/gym-api', {
      headers: { 'Origin': 'https://a.com' }
    });
    const resA = await worker.fetch(reqA, localEnv, {} as any);
    expect(resA.headers.get('Access-Control-Allow-Origin')).toBe('https://a.com');

    const reqB = new Request('https://api.example.com/gym-api', {
      headers: { 'Origin': 'https://b.com' }
    });
    const resB = await worker.fetch(reqB, localEnv, {} as any);
    expect(resB.headers.get('Access-Control-Allow-Origin')).toBe('https://b.com');
  });
});
