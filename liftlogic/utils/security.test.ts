import { describe, it, expect } from 'vitest';
import { timingSafeEqual } from './security';

describe('timingSafeEqual', () => {
  it('should return true for identical strings', async () => {
    expect(await timingSafeEqual('hello', 'hello')).toBe(true);
    expect(await timingSafeEqual('', '')).toBe(true);
    expect(await timingSafeEqual('a long string of characters', 'a long string of characters')).toBe(true);
  });

  it('should return false for different strings of the same length', async () => {
    expect(await timingSafeEqual('hello', 'world')).toBe(false);
    expect(await timingSafeEqual('abc', 'abd')).toBe(false);
    expect(await timingSafeEqual('ABC', 'abc')).toBe(false);
  });

  it('should return false for strings of different lengths', async () => {
    expect(await timingSafeEqual('hello', 'helloo')).toBe(false);
    expect(await timingSafeEqual('hello', 'hell')).toBe(false);
    expect(await timingSafeEqual('', ' ')).toBe(false);
  });
});
