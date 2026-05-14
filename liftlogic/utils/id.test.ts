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
    it('should fall back to alternative implementation when crypto is undefined', () => {
      vi.stubGlobal('crypto', undefined);

      const id = generateId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
      expect(id).not.toBe('mocked-uuid-1234');
    });

    it('should fall back when crypto exists but randomUUID is missing', () => {
      vi.stubGlobal('crypto', {}); // No randomUUID

      const id = generateId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('should generate a deterministic ID from Date and Math in fallback mode', () => {
      vi.stubGlobal('crypto', undefined);

      const mockTime = 1234567890;
      const mockRandom = 0.123456789;

      vi.spyOn(Date, 'now').mockReturnValue(mockTime);
      vi.spyOn(Math, 'random').mockReturnValue(mockRandom);

      const id = generateId();

      // Date.now().toString(36) + Math.random().toString(36).substring(2)
      const expectedId = mockTime.toString(36) + mockRandom.toString(36).substring(2);
      expect(id).toBe(expectedId);
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
