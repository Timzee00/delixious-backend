import { describe, it, expect } from 'vitest';
import { formatNaira } from '../src/lib/format.js';

describe('formatNaira', () => {
  it('formats a whole number with the naira sign', () => {
    expect(formatNaira(2500)).toBe('₦2,500');
  });

  it('adds thousands separators for large amounts', () => {
    expect(formatNaira(1250000)).toBe('₦1,250,000');
  });

  it('handles zero', () => {
    expect(formatNaira(0)).toBe('₦0');
  });

  it('handles string input (as Postgres numeric columns arrive over JSON)', () => {
    expect(formatNaira('3200')).toBe('₦3,200');
  });
});
