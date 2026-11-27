/** The Worker is the only caller of this Durable Object. The cookie is an
 * independent random credential. Only its digest is persisted.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const IDLE_MS = 90 * DAY_MS;
const MAX_AGE_MS = 180 * DAY_MS;

export const isSessionToken = (token: string) => /^v2\.[a-f0-9]{64}$/.test(token);

const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
export const newSessionToken = () => 'v2.' + hex(crypto.getRandomValues(new Uint8Array(32)));

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return hex(new Uint8Array(digest));
}

interface Credentials {
  TARGET_HASH?: string;
  PASSWORD?: string;
  SESSION_SECRET?: string;
}

export async function getTargetHash(env: Credentials): Promise<string | null> {
  if (env.TARGET_HASH) return env.TARGET_HASH.toLowerCase();
  return env.PASSWORD ? sha256(env.PASSWORD) : null;
}

const versionOf = (hash: string, secret?: string) => sha256(JSON.stringify([hash, secret ?? '']));

type Operation = 'create' | 'check' | 'renew' | 'revoke';

interface SessionRequest {
  operation: Operation;
  tokenHash: string;
  credentialVersion: string;
}

export async function accessSession(
  env: { SESSIONS: DurableObjectNamespace; SESSION_SECRET?: string },
  operation: Operation,
  token: string,
  targetHash: string
): Promise<number> {
  const [tokenHash, credentialVersion] = await Promise.all([
    sha256(token),
    versionOf(targetHash, env.SESSION_SECRET)
  ]);
  const store = env.SESSIONS.get(env.SESSIONS.idFromName('sessions'));
  const response = await store.fetch('https://sessions.internal/', {
    method: 'POST',
    body: JSON.stringify({ operation, tokenHash, credentialVersion } satisfies SessionRequest)
  });
  if (!response.ok) throw new Error('Session store unavailable');
  return await response.json<number>();
}

export class SessionStore {
  private readonly sql: SqlStorage;
  private readonly activeVersion: Promise<string | null>;

  constructor(state: DurableObjectState, env: Credentials) {
    this.activeVersion = getTargetHash(env).then(hash => hash && versionOf(hash, env.SESSION_SECRET));
    this.sql = state.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      credential_version TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      absolute_expiry INTEGER NOT NULL
    )`);
  }

  async fetch(request: Request): Promise<Response> {
    const { operation, tokenHash, credentialVersion } = await request.json<SessionRequest>();
    if (operation === 'revoke') {
      this.sql.exec('DELETE FROM sessions WHERE token_hash = ?', tokenHash);
      return Response.json(0);
    }

    // The object's own configuration is authoritative during a rolling deploy.
    // An old Worker must not invalidate sessions belonging to the new version.
    const activeVersion = await this.activeVersion;
    if (!activeVersion || activeVersion !== credentialVersion) {
      return operation === 'create' ? new Response(null, { status: 503 }) : Response.json(0);
    }
    const now = Date.now();
    // All SQL below is synchronous in one object. Renewal can update a live
    // row, but cannot recreate a row that a concurrent logout has removed.
    this.sql.exec('DELETE FROM sessions WHERE expires_at <= ? OR credential_version <> ?', now, activeVersion);
    if (operation === 'create') {
      const expiresAt = now + IDLE_MS;
      this.sql.exec(
        'INSERT INTO sessions (token_hash, credential_version, expires_at, absolute_expiry) VALUES (?, ?, ?, ?)',
        tokenHash, activeVersion, expiresAt, now + MAX_AGE_MS
      );
      return Response.json(expiresAt);
    }
    if (operation === 'renew') {
      this.sql.exec('UPDATE sessions SET expires_at = min(?, absolute_expiry) WHERE token_hash = ?', now + IDLE_MS, tokenHash);
    }
    const [row] = this.sql.exec<{ expires_at: number }>(
      'SELECT expires_at FROM sessions WHERE token_hash = ?', tokenHash
    ).toArray();
    return Response.json(row?.expires_at ?? 0);
  }
}
