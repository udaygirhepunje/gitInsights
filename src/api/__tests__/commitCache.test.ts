import { describe, expect, it } from 'vitest';

import { isMonthSealed } from '../commitCache';
import { monthKeyFromDate } from '../githubCommitsSearch';

describe('commit month sealing', () => {
  it('treats current month as not sealed', () => {
    const now = new Date(2026, 4, 15);
    expect(isMonthSealed('2026-05', now)).toBe(false);
  });

  it('seals month that ended more than 30 days ago', () => {
    const now = new Date(2026, 4, 15);
    expect(isMonthSealed('2026-01', now)).toBe(true);
  });

  it('monthKeyFromDate matches YYYY-MM', () => {
    expect(monthKeyFromDate(new Date(2026, 0, 7))).toBe('2026-01');
  });
});
