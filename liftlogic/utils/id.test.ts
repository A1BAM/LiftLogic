import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateId } from './id';

describe('generateId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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
    vi.stubGlobal('crypto', undefined);
    const mockTime = 1712720000000;
    const mockRandom = 0.123456789;
    vi.spyOn(Date, 'now').mockReturnValue(mockTime);
    vi.spyOn(Math, 'random').mockReturnValue(mockRandom);

    const expectedPart1 = mockTime.toString(36);
    const expectedPart2 = mockRandom.toString(36).substring(2);

    const id = generateId();
    expect(id).toBe(expectedPart1 + expectedPart2);
  });

  it('should handle Math.random() edge case: 0', () => {
    vi.stubGlobal('crypto', undefined);
    vi.spyOn(Date, 'now').mockReturnValue(1712720000000);
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const id = generateId();
    const expectedPrefix = (1712720000000).toString(36);
    // 0.toString(36).substring(2) is empty string
    expect(id).toBe(expectedPrefix);
  });

  it('should handle Math.random() edge case: near 1', () => {
    vi.stubGlobal('crypto', undefined);
    vi.spyOn(Date, 'now').mockReturnValue(1712720000000);
    vi.spyOn(Math, 'random').mockReturnValue(0.999999999999);

    const id = generateId();
    const expectedPrefix = (1712720000000).toString(36);
    const expectedSuffix = (0.999999999999).toString(36).substring(2);
    expect(id).toBe(expectedPrefix + expectedSuffix);
  });
});
