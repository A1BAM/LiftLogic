import { describe, it, expect, vi } from 'vitest';
import worker from './worker';

describe('worker CORS', () => {
  it('should not reflect origin when ALLOWED_ORIGIN is *', async () => {
    const request = new Request('http://localhost/gym-api', {
      headers: { 'Origin': 'http://malicious.com' }
    });
    const env = {
      ALLOWED_ORIGIN: '*',
      DATABASE_URL: 'dummy',
      ASSETS: { fetch: vi.fn() }
    };
    const ctx = {} as any;

    const response = await worker.fetch(request, env as any, ctx);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('should allow Authorization header in CORS', async () => {
    const request = new Request('http://localhost/gym-api', {
      method: 'OPTIONS',
      headers: { 'Origin': 'http://localhost' }
    });
    const env = {
      ALLOWED_ORIGIN: '*',
      DATABASE_URL: 'dummy',
      ASSETS: { fetch: vi.fn() }
    };
    const ctx = {} as any;

    const response = await worker.fetch(request, env as any, ctx);
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
  });

  it('should reflect origin only when it matches ALLOWED_ORIGIN', async () => {
    const request = new Request('http://localhost/gym-api', {
      headers: { 'Origin': 'http://trusted.com' }
    });
    const env = {
      ALLOWED_ORIGIN: 'http://trusted.com',
      DATABASE_URL: 'dummy',
      ASSETS: { fetch: vi.fn() }
    };
    const ctx = {} as any;

    const response = await worker.fetch(request, env as any, ctx);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://trusted.com');
  });
});
