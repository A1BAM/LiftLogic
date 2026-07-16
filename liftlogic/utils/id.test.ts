import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateId } from './id';

describe('generateId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('with crypto.randomUUID available', () => {
    it('should use crypto.randomUUID when available', () => {
      const mockUUID = 'mocked-uuid-1234';
      vi.stubGlobal('crypto', {
        randomUUID: vi.fn().mockReturnValue(mockUUID),
      });

      const id = generateId();
      expect(id).toBe(mockUUID);
      expect(crypto.randomUUID).toHaveBeenCalled();
    });
  });

  describe('fallback implementation', () => {
    it('should throw an error when crypto is undefined', () => {
      vi.stubGlobal('crypto', undefined);

      expect(() => generateId()).toThrow('Secure random number generation is not supported in this environment.');
    });

    it('should fall back to getRandomValues when randomUUID is missing', () => {
      const mockValues = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
      vi.stubGlobal('crypto', {
        getRandomValues: vi.fn().mockImplementation((arr) => {
          arr.set(mockValues);
          return arr;
        }),
      });

      const id = generateId();
      expect(typeof id).toBe('string');
      expect(id).toBe('0102030405060708090a0b0c0d0e0f10');
      expect(crypto.getRandomValues).toHaveBeenCalled();
    });

    it('should throw an error when crypto exists but secure methods are missing', () => {
      vi.stubGlobal('crypto', {}); // No randomUUID or getRandomValues

      expect(() => generateId()).toThrow('Secure random number generation is not supported in this environment.');
    });
  });

  describe('general properties', () => {
    it('should return a string', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
    });

    it('should return non-empty IDs', () => {
      const id = generateId();
      expect(id.length).toBeGreaterThan(0);
    });

    it('should generate unique IDs in default environment', () => {
      const ids = new Set();
      for (let i = 0; i < 1000; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(1000);
    });
  });
});
