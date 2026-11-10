import { describe, it, expect } from 'vitest';
import { cleanDecimal, cleanInteger } from './number';

describe('cleanDecimal', () => {
  it('keeps a fraction as typed, including while it is half-typed', () => {
    expect(cleanDecimal('27.5')).toBe('27.5');
    expect(cleanDecimal('27.')).toBe('27.');
    expect(cleanDecimal('.5')).toBe('.5');
  });

  it('reads a comma as the decimal point, for regions whose keypad types one', () => {
    expect(cleanDecimal('27,5')).toBe('27.5');
  });

  it('drops a second point and anything that is not a number', () => {
    expect(cleanDecimal('2.7.5')).toBe('2.75');
    expect(cleanDecimal('-27.5 lbs')).toBe('27.5');
  });
});

describe('cleanInteger', () => {
  it('keeps digits only', () => {
    expect(cleanInteger('12')).toBe('12');
    expect(cleanInteger('8.5')).toBe('85');
    expect(cleanInteger('-3')).toBe('3');
  });
});
