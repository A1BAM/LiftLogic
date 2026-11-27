
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import entry, { type Env, SessionStore } from './worker';

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

// Login is the one place a real password meets its real hash.
const PASSWORD = 'correct horse battery staple';
const PASSWORD_HASH = Array.from(
  new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(PASSWORD)))
).map(b => b.toString(16).padStart(2, '0')).join('');
const cookieFor = (token: string) => `__Host-liftlogic_session=${token}`;

type TestEnv = Omit<Env, 'SESSIONS'> & Partial<Pick<Env, 'SESSIONS'>>;
let database: DatabaseSync;
let SESSION: string;
function sessionBinding(env: TestEnv): DurableObjectNamespace {
  const sql = {
    exec(statement: string, ...values: SQLInputValue[]) {
      const rows = database.prepare(statement).all(...values);
      return { toArray: () => rows };
    }
  };
  const store = new SessionStore({ storage: { sql } } as unknown as DurableObjectState, env);
  return {
    idFromName: (name: string) => name,
    get: () => ({ fetch: (url: string, init: RequestInit) => store.fetch(new Request(url, init)) })
  } as unknown as DurableObjectNamespace;
}

const worker = {
  fetch: (request: Request, env: TestEnv, ctx: ExecutionContext) =>
    entry.fetch(request, { ...env, SESSIONS: env.SESSIONS ?? sessionBinding(env) }, ctx)
};

const loginEnv = (): TestEnv => ({
  TARGET_HASH: PASSWORD_HASH, DATABASE_URL: 'dummy', ASSETS: { fetch: vi.fn() },
  LOGIN_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) }
});

async function signIn(env: TestEnv = loginEnv(), password = PASSWORD) {
  const request = new Request('http://localhost/gym-api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password })
  });
  const response = await worker.fetch(request, env, {} as ExecutionContext);
  expect(response.status).toBe(200);
  return response.headers.get('Set-Cookie')!.split(';')[0].split('=')[1];
}

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

  beforeEach(async () => {
    database = new DatabaseSync(':memory:');
    SESSION = await signIn();
  });

  afterEach(() => {
    database.close();
    vi.useRealTimers();
    vi.clearAllMocks();
  });


  describe('Authentication Endpoints', () => {
    it('blocks GET requests on login/logout paths without auth', async () => {
      const loginRequest = createRequest('GET', 'http://localhost/gym-api/login', undefined, null as any);
      const logoutRequest = createRequest('GET', 'http://localhost/gym-api/logout', undefined, null as any);
      const env = { DATABASE_URL: 'dummy', TARGET_HASH: PASSWORD_HASH, ASSETS: { fetch: vi.fn() } as any };

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
      expect(cookie).toMatch(/^__Host-liftlogic_session=v2\.[0-9a-f]{64};/);
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
        TARGET_HASH: PASSWORD_HASH,
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
        TARGET_HASH: PASSWORD_HASH,
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
      const env = { DATABASE_URL: 'dummy', TARGET_HASH: PASSWORD_HASH, ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'Server Configuration Error' });
    });

    it('fails closed when login rate limiting is unavailable', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api/login', { password: PASSWORD }, null as any);
      const env = {
        DATABASE_URL: 'dummy',
        TARGET_HASH: PASSWORD_HASH,
        LOGIN_RATE_LIMITER: { limit: vi.fn().mockRejectedValue(new Error('rate-limit outage')) },
        ASSETS: { fetch: vi.fn() } as any
      };

      const response = await worker.fetch(request, env, {} as any);

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: 'Login temporarily unavailable' });
    });



    it('handles logout', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api/logout', {}, null as any);
      const env = { DATABASE_URL: 'dummy', TARGET_HASH: PASSWORD_HASH, ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(200);
      expect(response.headers.get('Set-Cookie')).toContain('__Host-liftlogic_session=;');
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
      const env = { DATABASE_URL: 'dummy', TARGET_HASH: PASSWORD_HASH, ASSETS: { fetch: vi.fn() } as any };
      const probe = (session: string | null) =>
        worker.fetch(createRequest('GET', 'http://localhost/gym-api/session', undefined, session), env, {} as any);

      it('accepts a registered session', async () => {
        expect((await probe(SESSION)).status).toBe(200);
      });

      it('no longer accepts the password hash itself as a cookie', async () => {
        expect((await probe(PASSWORD_HASH)).status).toBe(401);
      });

      it('does not accept the password hash as a bearer token either', async () => {
        const request = new Request('http://localhost/gym-api/session', {
          headers: { Authorization: 'Bearer testsecret' }
        });
        expect((await worker.fetch(request, env, {} as any)).status).toBe(401);
      });

      it('rejects expired, altered, unregistered and legacy sessions', async () => {
        const altered = SESSION.slice(0, -1) + (SESSION.endsWith('0') ? '1' : '0');
        expect((await probe(altered)).status).toBe(401);
        expect((await probe('v1.legacy-cookie')).status).toBe(401);
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(Date.now() + 91 * 86400000);
        expect((await probe(SESSION)).status).toBe(401);
      });

      it('revokes only the session that logged out, including copies handed to another client', async () => {
        const other = await signIn();
        expect(other).not.toBe(SESSION);
        expect((await probe(SESSION)).status).toBe(200);
        const logout = () => worker.fetch(createRequest('POST', 'http://localhost/gym-api/logout/', {}, SESSION), env, {} as any);
        expect((await logout()).status).toBe(200);
        expect((await probe(SESSION)).status).toBe(401);
        expect((await worker.fetch(createRequest('GET', 'http://localhost/gym-api', undefined, SESSION), env, {} as any)).status).toBe(401);
        expect((await logout()).status).toBe(200);
        expect((await probe(other)).status).toBe(200);
      });

      it.each([undefined, 'an-independent-secret'])('invalidates sessions after credential rotation (%s)', async secret => {
        const config = { ...loginEnv(), SESSION_SECRET: secret };
        const token = await signIn(config);
        const check = (change: Partial<TestEnv>) => worker.fetch(
          createRequest('GET', 'http://localhost/gym-api/session', undefined, token), { ...config, ...change }, {} as any
        );
        expect((await check({})).status).toBe(200);
        expect((await check({ TARGET_HASH: 'rotated' })).status).toBe(401);
        expect((await check({})).status).toBe(401);
      });

      it('keeps current sessions when an older Worker reaches the new store', async () => {
        const config = loginEnv();
        const token = await signIn(config);
        const stale = { ...config, TARGET_HASH: 'previous', SESSIONS: sessionBinding(config) };
        expect((await worker.fetch(createRequest('GET', 'http://localhost/gym-api/session', undefined, token), stale, {} as any)).status).toBe(401);
        expect((await probe(token)).status).toBe(200);
      });

      it('revokes the host-only session even if the legacy cookie is also present', async () => {
        const logout = new Request('https://app.example/gym-api/logout', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'liftlogic_auth_token=legacy; ' + cookieFor(SESSION) }
        });
        const response = await worker.fetch(logout, env, {} as any);
        expect(response.status).toBe(200);
        expect(response.headers.getSetCookie()).toHaveLength(2);
        expect((await probe(SESSION)).status).toBe(401);
      });

      it('also invalidates sessions when the optional session secret changes', async () => {
        const req = createRequest('GET', 'http://localhost/gym-api/session', undefined, SESSION);
        expect((await worker.fetch(req, { ...env, SESSION_SECRET: 'rotated' }, {} as any)).status).toBe(401);
      });

      it('renews the idle expiry up to the original 180-day limit', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        const start = Date.now();
        const token = await signIn();
        for (const days of [70, 140]) {
          vi.setSystemTime(start + days * 86400000);
          const response = await probe(token);
          expect(response.status).toBe(200);
          const maxAge = Math.min(90, 180 - days) * 86400;
          expect(response.headers.get('Set-Cookie')).toContain(`Max-Age=${maxAge}`);
        }
        vi.setSystemTime(start + 180 * 86400000);
        expect((await probe(token)).status).toBe(401);
      });

      it('fails closed on a storage outage and lets the browser retry logout', async () => {
        const down = { ...loginEnv(), SESSIONS: { idFromName() { throw new Error('unavailable'); } } as unknown as DurableObjectNamespace };
        for (const [method, path, body] of [['GET', 'session', undefined], ['POST', 'logout', {}], ['POST', 'login', { password: PASSWORD }]] as const) {
          const response = await worker.fetch(createRequest(method, `http://localhost/gym-api/${path}`, body), down, {} as any);
          expect(response.status).toBe(503);
          expect(response.headers.get('Set-Cookie')).toBeNull();
        }
        expect((await probe(SESSION)).status).toBe(200);
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
      const env = { DATABASE_URL: 'dummy', TARGET_HASH: PASSWORD_HASH, ASSETS: assets as any };

      expect(await worker.fetch(request, env, {} as any)).toBe(page);
      expect(assets.fetch).toHaveBeenCalledWith(request);
    });

    it('handles OPTIONS preflight request', async () => {
      const request = createRequest('OPTIONS', 'http://localhost/gym-api');
      const env = { DATABASE_URL: 'dummy', TARGET_HASH: PASSWORD_HASH, ALLOWED_ORIGIN: '*' as any, ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, DELETE, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull();
    });

    it('checks the origin for every mutation, including login, logout and trailing-slash routes', async () => {
      const env = { ...loginEnv(), ALLOWED_ORIGIN: '*' };
      for (const [method, path] of [['POST', ''], ['POST', '/bulk/'], ['POST', '/login'], ['POST', '/logout/'], ['DELETE', '']]) {
        const request = new Request('https://app.example/gym-api' + path, {
          method, headers: { Origin: 'https://other.example', 'Content-Type': 'application/json', Cookie: cookieFor(SESSION) },
          body: '{}'
        });
        expect((await worker.fetch(request, env, {} as any)).status).toBe(403);
      }
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('accepts JSON writes from same and explicitly trusted origins, rejects other media types', async () => {
      const env = { ...loginEnv(), ALLOWED_ORIGIN: 'https://client.example' };
      const post = (origin: string | null, contentType: string, site?: string) => {
        const headers = new Headers({ 'Content-Type': contentType, Cookie: cookieFor(SESSION) });
        if (origin !== null) headers.set('Origin', origin);
        if (site) headers.set('Sec-Fetch-Site', site);
        return worker.fetch(new Request('https://app.example/gym-api/bulk', { method: 'POST', headers, body: '[]' }), env, {} as any);
      };
      for (const origin of ['https://app.example', 'https://client.example']) {
        expect((await post(origin, 'Application/JSON; charset=utf-8')).status).toBe(200);
        expect((await post(origin, 'text/plain')).status).toBe(415);
        expect((await post(origin, 'application/json-extra')).status).toBe(415);
      }
      expect((await post(null, 'application/json', 'same-site')).status).toBe(403);
      expect((await post('null', 'application/json', 'cross-site')).status).toBe(403);
    });

    it('reflects origin if in ALLOWED_ORIGIN whitelist', async () => {
      const request = new Request('http://localhost/gym-api', {
        headers: new Headers({ 'Origin': 'https://liftlogic.app' })
      });
      const env = { DATABASE_URL: 'dummy', TARGET_HASH: PASSWORD_HASH, ALLOWED_ORIGIN: 'https://liftlogic.app,http://localhost:3000' as any, ASSETS: { fetch: vi.fn() } as any };

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
      const env = { ...loginEnv(), TARGET_HASH: undefined, PASSWORD: 'mytestpassword' };
      const request = createRequest('GET', 'http://localhost/gym-api', undefined, await signIn(env, 'mytestpassword'));
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
      const env = { DATABASE_URL: 'real', TARGET_HASH: PASSWORD_HASH, ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ authenticated: true });
      // The whole point of the endpoint: opening the app asks this instead of
      // downloading the entire workout history to find out it is logged in.
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('rejects an unauthenticated probe', async () => {
      const request = createRequest('GET', 'http://localhost/gym-api/session', undefined, null as any);
      const env = { DATABASE_URL: 'real', TARGET_HASH: PASSWORD_HASH, ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);

      expect(response.status).toBe(401);
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  describe('Hardening', () => {
    const base = { DATABASE_URL: 'real', TARGET_HASH: PASSWORD_HASH, ASSETS: { fetch: vi.fn() } as any };
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
      const env = { DATABASE_URL: 'postgres://dummy:dummy@localhost:5432/dummy', TARGET_HASH: PASSWORD_HASH, ASSETS: { fetch: vi.fn() } as any };

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
      const env = { DATABASE_URL: 'real', TARGET_HASH: PASSWORD_HASH, ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);

      expect(response.status).toBe(200);
    });
  });

  describe('POST Bulk Requests (Validation)', () => {
    it('returns 400 for non-array payload', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api/bulk', { id: '1' });
      const env = { DATABASE_URL: 'real', TARGET_HASH: PASSWORD_HASH, ASSETS: { fetch: vi.fn() } as any };
      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('Invalid payload: must be an array');
    });

    it('returns 400 for invalid item in array', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api/bulk', [{ id: '' }]);
      const env = { DATABASE_URL: 'real', TARGET_HASH: PASSWORD_HASH, ASSETS: { fetch: vi.fn() } as any };
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
      const env = { DATABASE_URL: 'real', TARGET_HASH: PASSWORD_HASH, ASSETS: { fetch: vi.fn() } as any };
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
      const env = { DATABASE_URL: 'real', TARGET_HASH: PASSWORD_HASH, ASSETS: { fetch: vi.fn() } as any };
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
      const env = { DATABASE_URL: 'real', TARGET_HASH: PASSWORD_HASH, ASSETS: { fetch: vi.fn() } as any };
      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('Invalid id');
    });

    it('returns 400 for invalid timestamp', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api', {
        id: '1', exerciseId: 'ex1', timestamp: -10, weight: 100, reps: 10
      });
      const env = { DATABASE_URL: 'real', TARGET_HASH: PASSWORD_HASH, ASSETS: { fetch: vi.fn() } as any };
      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('Invalid timestamp');
    });

    it('returns 400 for invalid weight (NaN)', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api', {
        id: '1', exerciseId: 'ex1', timestamp: 123, weight: NaN, reps: 10
      });
      const env = { DATABASE_URL: 'real', TARGET_HASH: PASSWORD_HASH, ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid weight' });
    });

    it('returns 400 for weight > 2000', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api', {
        id: '1', exerciseId: 'ex1', timestamp: 123, weight: 2001, reps: 10
      });
      const env = { DATABASE_URL: 'real', TARGET_HASH: PASSWORD_HASH, ASSETS: { fetch: vi.fn() } as any };
      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid weight' });
    });

    it('returns 400 for reps > 1000', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api', {
        id: '1', exerciseId: 'ex1', timestamp: 123, weight: 100, reps: 1001
      });
      const env = { DATABASE_URL: 'real', TARGET_HASH: PASSWORD_HASH, ASSETS: { fetch: vi.fn() } as any };
      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid reps' });
    });

    it('returns 400 for sets > 100', async () => {
      const request = createRequest('POST', 'http://localhost/gym-api', {
        id: '1', exerciseId: 'ex1', timestamp: 123, weight: 100, reps: 10, sets: 101
      });
      const env = { DATABASE_URL: 'real', TARGET_HASH: PASSWORD_HASH, ASSETS: { fetch: vi.fn() } as any };
      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid sets' });
    });

    it('returns 400 if items array exceeds 10,000 items', async () => {
      const items = Array(10001).fill({ id: '1', exerciseId: 'ex1', timestamp: 123, weight: 100, reps: 10 });
      const request = createRequest('POST', 'http://localhost/gym-api', items);
      const env = { DATABASE_URL: 'real', TARGET_HASH: PASSWORD_HASH, ASSETS: { fetch: vi.fn() } as any };
      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('Payload too large: max 10,000 items');
    });
  });

  describe('DELETE Requests', () => {
    it('returns 400 if body is empty', async () => {
      const request = createRequest('DELETE', 'http://localhost/gym-api', {});
      const env = { DATABASE_URL: 'real', TARGET_HASH: PASSWORD_HASH, ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('Missing ID or Exercise ID');
    });

    it('returns 400 if exerciseId is invalid', async () => {
      const request = createRequest('DELETE', 'http://localhost/gym-api', { exerciseId: '' });
      const env = { DATABASE_URL: 'real', TARGET_HASH: PASSWORD_HASH, ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('Invalid exerciseId');
    });

    it('returns 400 if id is invalid', async () => {
      const request = createRequest('DELETE', 'http://localhost/gym-api', { id: '' });
      const env = { DATABASE_URL: 'real', TARGET_HASH: PASSWORD_HASH, ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid id' });
    });
  });

  describe('Storage: sets in workouts, exercises in their own table', () => {
    const env = { DATABASE_URL: 'real', TARGET_HASH: PASSWORD_HASH, ASSETS: { fetch: vi.fn() } as any };
    const curl = { id: 'DUMBBELL_CURL', name: 'Dumbbell Bicep Curls', muscleGroup: 'Biceps', defaultWeight: 25, increment: 5, targetReps: 12, dayType: 'PULL' };
    const definitionRow = (ex: object, id = 'def_DUMBBELL_CURL') =>
      ({ id, exerciseId: '__DEFINITION__', timestamp: 1, weight: 0, reps: 0, sets: 0, notes: JSON.stringify(ex) });
    const sqlOf = (call: unknown[]) => String(call[0]).replace(/\s+/g, ' ');

    it('reads exercises from their table and hands them to the app in the shape it expects', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 's1', exercise_id: 'DUMBBELL_CURL', timestamp: '1700000000000', weight: '27.5', reps: 10 }] })
        .mockResolvedValueOnce({ rows: [{
          id: 'DUMBBELL_CURL', name: 'Dumbbell Bicep Curls', muscle_group: 'Biceps', day_type: 'PULL',
          default_weight: '25', increment: '5', target_reps: 12, is_custom: false, is_archived: true, is_slot_choice: false
        }] });

      const response = await worker.fetch(createRequest('GET', 'http://localhost/gym-api'), env, {} as any);
      const body = await response.json() as any[];

      expect(body[0]).toEqual({ id: 's1', exerciseId: 'DUMBBELL_CURL', timestamp: 1700000000000, weight: 27.5, reps: 10, sets: 1 });
      expect(body[1]).toMatchObject({ id: 'def_DUMBBELL_CURL', exerciseId: '__DEFINITION__' });
      expect(JSON.parse(body[1].notes)).toEqual({ ...curl, isArchived: true });
      // Neither query touches the columns that are being dropped.
      expect(mockQuery.mock.calls.map(sqlOf).join(' ')).not.toMatch(/\b(notes|sets)\b/);
    });

    it('stores an exercise in the exercises table and a set without notes or sets', async () => {
      const items = [
        { id: 's1', exerciseId: 'DUMBBELL_CURL', timestamp: 1700000000000, weight: 27.5, reps: 10, sets: 1 },
        definitionRow({ ...curl, isArchived: true })
      ];
      const response = await worker.fetch(createRequest('POST', 'http://localhost/gym-api/bulk', items), env, {} as any);

      expect(response.status).toBe(200);
      const [exerciseCall, setCall] = mockQuery.mock.calls;
      expect(sqlOf(exerciseCall)).toMatch(/^INSERT INTO exercises/);
      expect(exerciseCall[1][0]).toEqual(['DUMBBELL_CURL']);
      expect(exerciseCall[1][8]).toEqual([true]); // is_archived
      expect(sqlOf(setCall)).toMatch(/^INSERT INTO workouts \(id, exercise_id, timestamp, weight, reps\)/);
      expect(setCall[1]).toEqual([['s1'], ['DUMBBELL_CURL'], [1700000000000], [27.5], [10]]);
      expect(mockQuery.mock.calls.map(sqlOf).join(' ')).not.toMatch(/\b(notes|sets)\b/);
    });

    it('refuses an exercise that does not validate, and saves nothing', async () => {
      for (const bad of [
        definitionRow({ ...curl, dayType: 'ARMS' }),
        definitionRow(curl, 'def_SOMETHING_ELSE'),
        { ...definitionRow(curl), notes: 'not json' }
      ]) {
        const response = await worker.fetch(createRequest('POST', 'http://localhost/gym-api', bad), env, {} as any);
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: 'Invalid exercise definition' });
      }
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('refuses reserved set IDs on both write paths before touching either table', async () => {
      const row = { id: 'def_custom-9', exerciseId: 'curl', timestamp: 1, weight: 10, reps: 1 };
      for (const [path, body] of [['/gym-api', row], ['/gym-api/bulk', [row]]] as const) {
        const response = await worker.fetch(createRequest('POST', 'http://localhost' + path, body), env, {} as any);
        expect(response.status).toBe(400);
      }
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('requires an explicit target for an ambiguous legacy delete and can remove a pre-existing set safely', async () => {
      const remove = (body: object) => worker.fetch(createRequest('DELETE', 'http://localhost/gym-api', body), env, {} as any);
      expect((await remove({ id: 'def_custom-9' })).status).toBe(409);
      expect((await remove({ setId: 'def_custom-9', definitionId: 'custom-9' })).status).toBe(400);
      expect(mockQuery).not.toHaveBeenCalled();
      expect((await remove({ setId: 'def_custom-9' })).status).toBe(200);
      expect(mockQuery).toHaveBeenCalledWith('DELETE FROM workouts WHERE id = $1', ['def_custom-9']);
    });

    it('deletes an exercise from its own table', async () => {
      await worker.fetch(createRequest('DELETE', 'http://localhost/gym-api', { definitionId: 'custom-9' }), env, {} as any);
      expect(sqlOf(mockQuery.mock.calls[0])).toBe('DELETE FROM exercises WHERE id = $1');
      expect(mockQuery.mock.calls[0][1]).toEqual(['custom-9']);
    });

    it('still deletes an ordinary set from workouts', async () => {
      await worker.fetch(createRequest('DELETE', 'http://localhost/gym-api', { id: 'abc' }), env, {} as any);
      expect(sqlOf(mockQuery.mock.calls[0])).toBe('DELETE FROM workouts WHERE id = $1');
    });
  });

  describe('Error Handling', () => {
    it('returns 500 without leaking DB details on generic error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Super secret DB credentials failed'));

      const request = createRequest('GET', 'http://localhost/gym-api');
      const env = { DATABASE_URL: 'real', TARGET_HASH: PASSWORD_HASH, ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'Internal Server Error' });
    });

    it('returns 400 for invalid JSON payload', async () => {
      const request = new Request('http://localhost/gym-api', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookieFor(SESSION) }, body: '{ invalid json: ' });
      const env = { DATABASE_URL: 'real', TARGET_HASH: PASSWORD_HASH, ASSETS: { fetch: vi.fn() } as any };
      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid JSON' });
    });
  });

  describe('Security and DoS Mitigation', () => {
    it('rejects an overly long session cookie to prevent CPU exhaustion', async () => {
      const longSecret = 'a'.repeat(1000);
      const request = createRequest('GET', 'http://localhost/gym-api', undefined, longSecret);
      const env = { DATABASE_URL: 'real', TARGET_HASH: PASSWORD_HASH, ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'Unauthorized' });
    });

    it('rejects an overly long login password to prevent CPU exhaustion', async () => {
      const longPassword = 'a'.repeat(1000);
      const request = createRequest('POST', 'http://localhost/gym-api/login', { password: longPassword }, null as any);
      const env = { DATABASE_URL: 'real', TARGET_HASH: PASSWORD_HASH, ASSETS: { fetch: vi.fn() } as any };

      const response = await worker.fetch(request, env, {} as any);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid password' });
    });

    it('rejects non-object or array payloads for endpoints expecting an object', async () => {
      const env = { DATABASE_URL: 'real', TARGET_HASH: PASSWORD_HASH, ASSETS: { fetch: vi.fn() } as any };

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
