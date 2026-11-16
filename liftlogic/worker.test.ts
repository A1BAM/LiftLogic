
import { describe, it, expect, vi, afterEach } from 'vitest';
import worker, { mintSession } from './worker';

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

// A real session for the password hash the tests' env uses. Requests carry
// this the way the browser does, as a cookie; the hash itself is never a
// credential outside /login.
const SESSION = await mintSession({}, 'testsecret');

// Login is the one place a real password meets its real hash.
const PASSWORD = 'correct horse battery staple';
const PASSWORD_HASH = Array.from(
  new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(PASSWORD)))
).map(b => b.toString(16).padStart(2, '0')).join('');
const cookieFor = (token: string) => `liftlogic_auth_token=${token}`;

describe('Worker', () => {
  /** `session`: omitted = a valid session, null = no cookie, a string = that cookie value verbatim. */
  const createRequest = (method: string, url: string, body?: any, session?: string | null) => {
    const headers = new Headers({
      ...(session !== null ? { Cookie: cookieFor(session ?? SESSION) } : {})
    });
    if (body) {
      headers.set('Content-Type', 'application/json');
    }
    return new Request(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
  };

  afterEach(() => {
    vi.clearAllMocks();
  });


  describe('Authentication Endpoints', () => {
    it('blocks GET requests on login/logout paths without auth', async () => {
      const loginRequest = createRequest('GET', 'http://localhost/gym-api/login', undefined, null as any);
      const logoutRequest = createRequest('GET', 'http://localhost/gym-api/logout', undefined, null as any);
      const env = { DATABASE_URL: 'dummy', TARGET_HASH: 'testsecret', ASSETS: { fetch: vi.fn() } as any };

      const loginRes = await worker.fetch(loginRequest, env, {} as any);
      expect(loginRes.status).toBe(401);

      const logoutRes = await worker.fetch(logoutRequest, env, {} as any);
      expect(logoutRes.status).toBe(401);
    });

    it('handles successful login', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api/login', { password: PASSWORD }, null as any);
      const env = {
        DATABASE_URL: 'dummy',
        TARGET_HASH: PASSWORD_HASH,
        LOGIN_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) },
        ASSETS: { fetch: vi.fn() } as any
      };

      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(200);
      const cookie = response.headers.get('Set-Cookie')!;
      expect(cookie).toMatch(/^liftlogic_auth_token=v1\.\d+\.[0-9a-f]{64};/);
      // The cookie must not carry the password hash any more.
      expect(cookie).not.toContain(PASSWORD_HASH);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('SameSite=Strict');

      // And what it carries is good for the next request.
      const token = cookie.split(';')[0].split('=')[1];
      const next = await worker.fetch(createRequest('GET', 'http://localhost/gym-api/session', undefined, token), env, {} as any);
      expect(next.status).toBe(200);
    });

    it('handles failed login', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api/login', { password: 'wrong' }, null as any);
      const env = {
        DATABASE_URL: 'dummy',
        TARGET_HASH: 'testsecret',
        LOGIN_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) },
        ASSETS: { fetch: vi.fn() } as any
      };

      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(401);
    });

    it('rate limits login attempts by connecting client', async () => {
      const limit = vi.fn().mockResolvedValue({ success: false });
      const request = new Request('http://localhost/gym-api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '203.0.113.10'
        },
        body: JSON.stringify({ password: 'wrong' })
      });
      const env = {
        DATABASE_URL: 'dummy',
        TARGET_HASH: 'testsecret',
        LOGIN_RATE_LIMITER: { limit },
        ASSETS: { fetch: vi.fn() } as any
      };

      const response = await worker.fetch(request, env, {} as any);

      expect(limit).toHaveBeenCalledOnce();
      const [{ key }] = limit.mock.calls[0];
      expect(key).toMatch(/^login:[a-f0-9]{64}$/);
      expect(key).not.toContain('203.0.113.10');
      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBe('60');
      expect(await response.json()).toEqual({ error: 'Too many login attempts' });
    });

    it('fails closed when the login rate-limit binding is missing', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api/login', { password: PASSWORD }, null as any);
      const env = { DATABASE_URL: 'dummy', TARGET_HASH: 'testsecret', ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'Server Configuration Error' });
    });

    it('fails closed when login rate limiting is unavailable', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api/login', { password: PASSWORD }, null as any);
      const env = {
        DATABASE_URL: 'dummy',
        TARGET_HASH: 'testsecret',
        LOGIN_RATE_LIMITER: { limit: vi.fn().mockRejectedValue(new Error('rate-limit outage')) },
        ASSETS: { fetch: vi.fn() } as any
      };

      const response = await worker.fetch(request, env, {} as any);

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: 'Login temporarily unavailable' });
    });



    it('handles logout', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api/logout', {}, null as any);
      const env = { DATABASE_URL: 'dummy', TARGET_HASH: 'testsecret', ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(200);
      expect(response.headers.get('Set-Cookie')).toContain('liftlogic_auth_token=;');
      expect(response.headers.get('Set-Cookie')).toContain('Max-Age=0');
    });



    describe('what counts as a password', () => {
      const env = () => ({
        DATABASE_URL: 'dummy',
        TARGET_HASH: PASSWORD_HASH,
        LOGIN_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) },
        ASSETS: { fetch: vi.fn() } as any
      });
      const login = (body: unknown, e: any = env()) =>
        worker.fetch(createRequest('POST', 'http://localhost/gym-api/login', body, null), e, {} as any);

      it('does not let the stored hash stand in for the password', async () => {
        // Knowing the stored hash must not be enough to get in.
        expect((await login({ password: PASSWORD_HASH })).status).toBe(401);
      });

      it('no longer accepts a hash field at all', async () => {
        const response = await login({ hash: PASSWORD_HASH });
        expect(response.status).toBe(400);
        expect(response.headers.get('Set-Cookie')).toBeNull();
      });

      it('accepts the password when TARGET_HASH was stored in upper case', async () => {
        expect((await login({ password: PASSWORD }, { ...env(), TARGET_HASH: PASSWORD_HASH.toUpperCase() })).status).toBe(200);
      });

      it('works from PASSWORD alone when no hash is configured', async () => {
        const { TARGET_HASH: _unused, ...rest } = env();
        expect((await login({ password: PASSWORD }, { ...rest, PASSWORD })).status).toBe(200);
        expect((await login({ password: 'not it' }, { ...rest, PASSWORD })).status).toBe(401);
      });
    });

    describe('session cookies', () => {
      const env = { DATABASE_URL: 'dummy', TARGET_HASH: 'testsecret', ASSETS: { fetch: vi.fn() } as any };
      const probe = (session: string | null) =>
        worker.fetch(createRequest('GET', 'http://localhost/gym-api/session', undefined, session), env, {} as any);

      it('accepts a signed session', async () => {
        expect((await probe(SESSION)).status).toBe(200);
      });

      it('no longer accepts the password hash itself as a cookie', async () => {
        expect((await probe('testsecret')).status).toBe(401);
      });

      it('does not accept the password hash as a bearer token either', async () => {
        const request = new Request('http://localhost/gym-api/session', {
          headers: { Authorization: 'Bearer testsecret' }
        });
        expect((await worker.fetch(request, env, {} as any)).status).toBe(401);
      });

      it('rejects a session that has expired', async () => {
        const ninetyOneDaysAgo = Date.now() - 91 * 24 * 60 * 60 * 1000;
        expect((await probe(await mintSession({}, 'testsecret', ninetyOneDaysAgo))).status).toBe(401);
      });

      it('rejects a session whose expiry was edited', async () => {
        const [version, , signature] = SESSION.split('.');
        const farFuture = Date.now() + 10 * 365 * 24 * 60 * 60 * 1000;
        expect((await probe(`${version}.${farFuture}.${signature}`)).status).toBe(401);
      });

      it('rejects a session signed for a different password', async () => {
        expect((await probe(await mintSession({}, 'the-old-password-hash'))).status).toBe(401);
      });

      it('rejects a session signed without the configured secret', async () => {
        const withSecret = { ...env, SESSION_SECRET: 'a-dedicated-secret' };
        const good = await mintSession(withSecret, 'testsecret');
        const request = (t: string) => createRequest('GET', 'http://localhost/gym-api/session', undefined, t);
        expect((await worker.fetch(request(good), withSecret, {} as any)).status).toBe(200);
        expect((await worker.fetch(request(SESSION), withSecret, {} as any)).status).toBe(401);
      });

      it('renews the session each time the app opens', async () => {
        const response = await probe(SESSION);
        expect(response.headers.get('Set-Cookie')).toMatch(/^liftlogic_auth_token=v1\.\d+\.[0-9a-f]{64}; .*Max-Age=7776000/);
      });

      it('marks responses as never to be cached', async () => {
        const response = await worker.fetch(createRequest('GET', 'http://localhost/gym-api'), env, {} as any);
        expect(response.status).toBe(200);
        expect(response.headers.get('Cache-Control')).toBe('no-store');
      });
    });
  });

  describe('CORS and Security Headers', () => {

    it('hands a non-API request straight to the asset store', async () => {
      // The page's own headers come from public/_headers, not from here.
      const page = new Response('<!doctype html>');
      const assets = { fetch: vi.fn().mockResolvedValue(page) };
      const request = new Request('http://localhost/');
      const env = { DATABASE_URL: 'dummy', TARGET_HASH: 'testsecret', ASSETS: assets as any };

      expect(await worker.fetch(request, env, {} as any)).toBe(page);
      expect(assets.fetch).toHaveBeenCalledWith(request);
    });

    it('handles OPTIONS preflight request', async () => {
      const request = createRequest('OPTIONS', 'http://localhost/gym-api');
      const env = { DATABASE_URL: 'dummy', TARGET_HASH: 'testsecret', ALLOWED_ORIGIN: '*' as any, ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, DELETE, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull();
    });

    it('reflects origin if in ALLOWED_ORIGIN whitelist', async () => {
      const request = new Request('http://localhost/gym-api', {
        headers: new Headers({ 'Origin': 'https://liftlogic.app' })
      });
      const env = { DATABASE_URL: 'dummy', TARGET_HASH: 'testsecret', ALLOWED_ORIGIN: 'https://liftlogic.app,http://localhost:3000' as any, ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://liftlogic.app');
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });
  });

  describe('Authentication', () => {

    it('returns 500 Server Configuration Error if TARGET_HASH and PASSWORD are not set', async () => {
      const request = createRequest('GET', 'http://localhost/gym-api');
      const env = { DATABASE_URL: 'dummy', ASSETS: { fetch: vi.fn() } as any };
      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'Server Configuration Error' });
    });


    it('authenticates using dynamically hashed PASSWORD if TARGET_HASH is not set', async () => {
      // Create a test password and hash it locally
      const password = 'mytestpassword';
      const msgBuffer = new TextEncoder().encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // A session signed for that password's hash is what gets in.
      const request = createRequest('GET', 'http://localhost/gym-api', undefined, await mintSession({}, hashHex));
      const env = { DATABASE_URL: 'dummy', PASSWORD: password, ASSETS: { fetch: vi.fn() } as any };
      const response = await worker.fetch(request, env, {} as any);

      expect(response.status).toBe(200);
    });

    it('returns 401 if TARGET_HASH is set and auth header is missing', async () => {
      const request = createRequest('GET', 'http://localhost/gym-api', undefined, null as any);
      const env = { DATABASE_URL: 'dummy', TARGET_HASH: 'mysecret', ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);

      expect(response.status).toBe(401);
      const data = await response.json() as any;
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('Session probe', () => {
    it('confirms a valid session without touching the database', async () => {
      const request = createRequest('GET', 'http://localhost/gym-api/session');
      const env = { DATABASE_URL: 'real', TARGET_HASH: 'testsecret', ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ authenticated: true });
      // The whole point of the endpoint: opening the app asks this instead of
      // downloading the entire workout history to find out it is logged in.
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('rejects an unauthenticated probe', async () => {
      const request = createRequest('GET', 'http://localhost/gym-api/session', undefined, null as any);
      const env = { DATABASE_URL: 'real', TARGET_HASH: 'testsecret', ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);

      expect(response.status).toBe(401);
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  describe('Hardening', () => {
    const base = { DATABASE_URL: 'real', TARGET_HASH: 'testsecret', ASSETS: { fetch: vi.fn() } as any };
    const set = { id: 'a', exerciseId: 'ex', timestamp: 1700000000000, weight: 100, reps: 8, sets: 1 };

    it('limits credential guesses against the data endpoints, not just /login', async () => {
      const limit = vi.fn().mockResolvedValue({ success: false });
      const request = createRequest('GET', 'http://localhost/gym-api/session', undefined, 'a-wrong-guess');

      const response = await worker.fetch(request, { ...base, API_RATE_LIMITER: { limit } }, {} as any);

      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBe('60');
      expect(limit).toHaveBeenCalledWith({ key: expect.stringMatching(/^api:[0-9a-f]{64}$/) });
    });

    it('is refused by the limiter even when the guess is right', async () => {
      const limit = vi.fn().mockResolvedValue({ success: false });
      const request = createRequest('GET', 'http://localhost/gym-api/session');

      const response = await worker.fetch(request, { ...base, API_RATE_LIMITER: { limit } }, {} as any);

      expect(response.status).toBe(429);
    });

    it('stays usable if the API limiter itself is down', async () => {
      const limit = vi.fn().mockRejectedValue(new Error('outage'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const request = createRequest('GET', 'http://localhost/gym-api/session');

      const response = await worker.fetch(request, { ...base, API_RATE_LIMITER: { limit } }, {} as any);

      expect(response.status).toBe(200);
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('logs database failures on the server, where production used to drop them', async () => {
      mockQuery.mockRejectedValueOnce(new Error('connection refused'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await worker.fetch(createRequest('GET', 'http://localhost/gym-api'), base, {} as any);

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'Internal Server Error' });
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Database Error'), 'connection refused');
      errorSpy.mockRestore();
    });

    it.each([
      ['fractional reps', { reps: 8.5 }],
      ['fractional sets', { sets: 1.5 }],
      ['a fractional timestamp', { timestamp: 1700000000000.5 }],
      ['an out-of-range timestamp', { timestamp: 1e400 }]
    ])('answers %s with a 400 rather than a database error', async (_name, patch) => {
      // JSON cannot carry Infinity, so the body is written by hand.
      const body = JSON.stringify({ ...set, ...patch }).replace('null', '1e400');
      const request = new Request('http://localhost/gym-api', {
        method: 'POST',
        headers: { Cookie: cookieFor(SESSION), 'Content-Type': 'application/json' },
        body
      });

      const response = await worker.fetch(request, base, {} as any);

      expect(response.status).toBe(400);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('refuses an oversized body that does not declare its length', async () => {
      const chunk = new TextEncoder().encode('a'.repeat(64 * 1024));
      let sent = 0;
      const stream = new ReadableStream({
        pull(controller) {
          if (sent++ < 40) controller.enqueue(chunk); // 2.5 MB, no Content-Length
          else controller.close();
        }
      });
      const request = new Request('http://localhost/gym-api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: stream,
        // @ts-expect-error duplex is required for a streamed body in Node
        duplex: 'half'
      });
      const env = { ...base, LOGIN_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) } };

      const response = await worker.fetch(request, env, {} as any);

      expect(response.status).toBe(413);
    });
  });

  describe('GET Requests', () => {
    it('returns empty array if dummy database URL is used and fetch fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Connection failed'));

      const request = createRequest('GET', 'http://localhost/gym-api');
      const env = { DATABASE_URL: 'postgres://dummy:dummy@localhost:5432/dummy', TARGET_HASH: 'testsecret', ASSETS: { fetch: vi.fn() } as any };

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
      const env = { DATABASE_URL: 'real', TARGET_HASH: 'testsecret', ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);

      expect(response.status).toBe(200);
    });
  });

  describe('POST Bulk Requests (Validation)', () => {
    it('returns 400 for non-array payload', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api/bulk', { id: '1' });
      const env = { DATABASE_URL: 'real', TARGET_HASH: 'testsecret', ASSETS: { fetch: vi.fn() } as any };
      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('Invalid payload: must be an array');
    });

    it('returns 400 for invalid item in array', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api/bulk', [{ id: '' }]);
      const env = { DATABASE_URL: 'real', TARGET_HASH: 'testsecret', ASSETS: { fetch: vi.fn() } as any };
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
      const env = { DATABASE_URL: 'real', TARGET_HASH: 'testsecret', ASSETS: { fetch: vi.fn() } as any };
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
      const env = { DATABASE_URL: 'real', TARGET_HASH: 'testsecret', ASSETS: { fetch: vi.fn() } as any };
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
      const env = { DATABASE_URL: 'real', TARGET_HASH: 'testsecret', ASSETS: { fetch: vi.fn() } as any };
      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('Invalid id');
    });

    it('returns 400 for invalid timestamp', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api', {
        id: '1', exerciseId: 'ex1', timestamp: -10, weight: 100, reps: 10
      });
      const env = { DATABASE_URL: 'real', TARGET_HASH: 'testsecret', ASSETS: { fetch: vi.fn() } as any };
      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('Invalid timestamp');
    });

    it('returns 400 for invalid weight (NaN)', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api', {
        id: '1', exerciseId: 'ex1', timestamp: 123, weight: NaN, reps: 10
      });
      const env = { DATABASE_URL: 'real', TARGET_HASH: 'testsecret', ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid weight' });
    });

    it('returns 400 for weight > 2000', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api', {
        id: '1', exerciseId: 'ex1', timestamp: 123, weight: 2001, reps: 10
      });
      const env = { DATABASE_URL: 'real', TARGET_HASH: 'testsecret', ASSETS: { fetch: vi.fn() } as any };
      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid weight' });
    });

    it('returns 400 for reps > 1000', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api', {
        id: '1', exerciseId: 'ex1', timestamp: 123, weight: 100, reps: 1001
      });
      const env = { DATABASE_URL: 'real', TARGET_HASH: 'testsecret', ASSETS: { fetch: vi.fn() } as any };
      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid reps' });
    });

    it('returns 400 for sets > 100', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api', {
        id: '1', exerciseId: 'ex1', timestamp: 123, weight: 100, reps: 10, sets: 101
      });
      const env = { DATABASE_URL: 'real', TARGET_HASH: 'testsecret', ASSETS: { fetch: vi.fn() } as any };
      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid sets' });
    });

    it('returns 400 if items array exceeds 10,000 items', async () => {
      const items = Array(10001).fill({ id: '1', exerciseId: 'ex1', timestamp: 123, weight: 100, reps: 10 });
      const request = createRequest('POST', 'http://localhost/gym-api', items);
      const env = { DATABASE_URL: 'real', TARGET_HASH: 'testsecret', ASSETS: { fetch: vi.fn() } as any };
      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('Payload too large: max 10,000 items');
    });
  });

  describe('DELETE Requests', () => {
    it('returns 400 if body is empty', async () => {
      const request = createRequest('DELETE', 'http://localhost/gym-api', {});
      const env = { DATABASE_URL: 'real', TARGET_HASH: 'testsecret', ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('Missing ID or Exercise ID');
    });

    it('returns 400 if exerciseId is invalid', async () => {
      const request = createRequest('DELETE', 'http://localhost/gym-api', { exerciseId: '' });
      const env = { DATABASE_URL: 'real', TARGET_HASH: 'testsecret', ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('Invalid exerciseId');
    });

    it('returns 400 if id is invalid', async () => {
      const request = createRequest('DELETE', 'http://localhost/gym-api', { id: '' });
      const env = { DATABASE_URL: 'real', TARGET_HASH: 'testsecret', ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid id' });
    });
  });

  describe('Error Handling', () => {
    it('returns 500 without leaking DB details on generic error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Super secret DB credentials failed'));

      const request = createRequest('GET', 'http://localhost/gym-api');
      const env = { DATABASE_URL: 'real', TARGET_HASH: 'testsecret', ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'Internal Server Error' });
    });

    it('returns 400 for invalid JSON payload', async () => {
      const request = new Request('http://localhost/gym-api', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookieFor(SESSION) }, body: '{ invalid json: ' });
      const env = { DATABASE_URL: 'real', TARGET_HASH: 'testsecret', ASSETS: { fetch: vi.fn() } as any };
      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid JSON' });
    });
  });

  describe('Security and DoS Mitigation', () => {
    it('rejects an overly long session cookie to prevent CPU exhaustion', async () => {
      const longSecret = 'a'.repeat(1000);
      const request = createRequest('GET', 'http://localhost/gym-api', undefined, longSecret);
      const env = { DATABASE_URL: 'real', TARGET_HASH: 'testsecret', ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'Unauthorized' });
    });

    it('rejects an overly long login password to prevent CPU exhaustion', async () => {
      const longPassword = 'a'.repeat(1000);
      const request = createRequest('POST', 'http://localhost/gym-api/login', { password: longPassword }, null as any);
      const env = { DATABASE_URL: 'real', TARGET_HASH: 'testsecret', ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid password' });
    });

    it('rejects non-object or array payloads for endpoints expecting an object', async () => {
      const env = { DATABASE_URL: 'real', TARGET_HASH: 'testsecret', ASSETS: { fetch: vi.fn() } as any };

      // 1. Login with array instead of object
      const loginRequest = createRequest('POST', 'http://localhost/gym-api/login', [1, 2, 3], null as any);
      const loginResponse = await worker.fetch(loginRequest, env, {} as any);
      expect(loginResponse.status).toBe(400);
      expect(await loginResponse.json()).toEqual({ error: 'Invalid payload' });

      // 2. The profile endpoint is gone: nothing in the app ever called it.
      const profileRequest = createRequest('POST', 'http://localhost/gym-api/profile', { heightCm: 180, weightLbs: 170 });
      const profileResponse = await worker.fetch(profileRequest, env, {} as any);
      expect(profileResponse.status).toBe(405);
      expect(mockQuery).not.toHaveBeenCalled();

      // 3. Delete with array instead of object
      const deleteRequest = createRequest('DELETE', 'http://localhost/gym-api', [1, 2, 3]);
      const deleteResponse = await worker.fetch(deleteRequest, env, {} as any);
      expect(deleteResponse.status).toBe(400);
      expect(await deleteResponse.json()).toEqual({ error: 'Invalid payload' });
    });
  });
});
