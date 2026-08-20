import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('deployed asset security', () => {
  it('does not execute Tailwind from a mutable third-party CDN', async () => {
    const entrypoints = await Promise.all([
      readFile(resolve('index.html'), 'utf8'),
      readFile(resolve('dist/index.html'), 'utf8')
    ]);

    for (const html of entrypoints) {
      expect(html).not.toContain('https://cdn.tailwindcss.com');
      expect(html).not.toMatch(/<script[^>]+src=["']https:\/\//i);
    }
  });
});
