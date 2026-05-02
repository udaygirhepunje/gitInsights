import { describe, expect, it } from 'vitest';

import {
  monthsOverlappingRange,
  monthsOverlappingRangeDescending,
  trailingMonthKeysDescending,
} from '../githubCommitsSearch';

describe('monthsOverlappingRangeDescending', () => {
  it('lists the same months as ascending overlap, newest first', () => {
    const from = new Date(2026, 3, 2);
    const to = new Date(2026, 4, 2);
    const asc = monthsOverlappingRange(from, to);
    const desc = monthsOverlappingRangeDescending(from, to);
    expect(desc).toEqual([...asc].reverse());
    expect(desc[0]).toBe('2026-05');
    expect(desc.at(-1)).toBe('2026-04');
  });
});

describe('trailingMonthKeysDescending', () => {
  it('starts at the current calendar month', () => {
    const now = new Date(2026, 4, 15);
    const keys = trailingMonthKeysDescending(3, now);
    expect(keys).toEqual(['2026-05', '2026-04', '2026-03']);
  });
});
