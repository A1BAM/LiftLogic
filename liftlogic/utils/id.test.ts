import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateId } from './id';

describe('generateId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return a string', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
  });

  it('should return non-empty IDs', () => {
    const id = generateId();
    expect(id.length).toBeGreaterThan(0);
  });

  it('should generate unique IDs', () => {
    const ids = new Set();
    for (let i = 0; i < 1000; i++) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(1000);
  });

  it('should use crypto.randomUUID when available', () => {
    const mockUUID = 'mocked-uuid';
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn().mockReturnValue(mockUUID),
    });

    const id = generateId();
    expect(id).toBe(mockUUID);
    expect(crypto.randomUUID).toHaveBeenCalled();
  });

  it('should fall back to alternative implementation when crypto.randomUUID is not available', () => {
    // Mock crypto to be undefined or missing randomUUID
    vi.stubGlobal('crypto', undefined);

    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);

    // Check that it looks like the fallback (date + random)
    // Date.now().toString(36) is usually around 8-9 chars
    // Math.random().toString(36).substring(2) varies
    expect(id).not.toBe('mocked-uuid');
  });
});
