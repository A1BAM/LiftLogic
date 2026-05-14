import { describe, it, expect } from 'vitest';
import { timingSafeEqual } from './security';

describe('timingSafeEqual', () => {
  it('should return true for identical strings', () => {
    expect(timingSafeEqual('hello', 'hello')).toBe(true);
    expect(timingSafeEqual('', '')).toBe(true);
    expect(timingSafeEqual('a long string of characters', 'a long string of characters')).toBe(true);
  });

  it('should return false for different strings of the same length', () => {
    expect(timingSafeEqual('hello', 'world')).toBe(false);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('ABC', 'abc')).toBe(false);
  });

  it('should return false for strings of different lengths', () => {
    expect(timingSafeEqual('hello', 'helloo')).toBe(false);
    expect(timingSafeEqual('hello', 'hell')).toBe(false);
    expect(timingSafeEqual('', ' ')).toBe(false);
  });
});
