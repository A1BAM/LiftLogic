import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('deployed asset security', () => {
  it('does not execute Tailwind from a mutable third-party CDN', async () => {
    // dist/index.html is build output, not committed. Read it with an
    // explanatory failure rather than a bare ENOENT, and never skip: silently
    // passing when the built entrypoint is absent would void this check.
    const read = async (path: string) => {
      try {
        return await readFile(resolve(path), 'utf8');
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT' && path.startsWith('dist/')) {
          throw new Error(
            `${path} is missing. Run \`npm run build\` before the tests so this ` +
            `check can inspect the built entrypoint.`
          );
        }
        throw err;
      }
    };

    const entrypoints = await Promise.all([
      read('index.html'),
      read('dist/index.html')
    ]);

    for (const html of entrypoints) {
      expect(html).not.toContain('https://cdn.tailwindcss.com');
      expect(html).not.toMatch(/<script[^>]+src=["']https:\/\//i);
    }
  });

  it('ships the headers file that protects the page itself', async () => {
    // Cloudflare serves the page without running the Worker, so this file is
    // the only thing that puts a CSP or framing protection on it. If it stops
    // being copied into the build, the page silently goes out bare.
    const headers = await readFile(resolve('dist/_headers'), 'utf8').catch(() => {
      throw new Error('dist/_headers is missing. Run `npm run build` first; it is copied from public/_headers.');
    });

    expect(headers).toMatch(/^\/\*$/m);
    expect(headers).toContain("frame-ancestors 'none'");
    expect(headers).toContain("script-src 'self'");
    expect(headers).not.toContain("'unsafe-inline'");
    expect(headers).toContain('X-Frame-Options: DENY');
    expect(headers).toContain('Strict-Transport-Security:');
    expect(headers).toMatch(/\/assets\/\*\n\s+Cache-Control: public, max-age=31536000, immutable/);
  });
});
