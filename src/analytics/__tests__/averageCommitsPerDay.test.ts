import { describe, expect, it } from 'vitest';

import {
  buildAverageCommitsTrend,
  countEffectiveWorkingDays,
  summarizeAverageCommitsPerDay,
} from '../averageCommitsPerDay';
import { buildOffDayContext } from '../offDay';

function mapByDate(input: Record<string, number>): Map<string, number> {
  return new Map(Object.entries(input));
}

describe('averageCommitsPerDay analytics', () => {
  it('uses effective working days denominator while still counting off-day commits in numerator', () => {
    const ctx = buildOffDayContext({
      workweek: { workdays: [1, 2, 3, 4, 5] },
      pto: [{ date: '2026-04-21' }],
      holidays: { regions: [], overrides: [] },
      holidayDates: ['2026-04-24'],
    });

    const effectiveWorkingDays = countEffectiveWorkingDays({
      from: new Date('2026-04-20T00:00:00'),
      to: new Date('2026-04-26T00:00:00'),
      ctx,
    });
    expect(effectiveWorkingDays).toBe(3);

    const summary = summarizeAverageCommitsPerDay({
      totalCommits: 4, // includes PTO + weekend commits
      effectiveWorkingDays,
    });
    expect(summary.average).toBeCloseTo(4 / 3, 5);
    expect(summary.isRestWindow).toBe(false);
  });

  it('returns a rest-window summary when effective working days are zero', () => {
    const ctx = buildOffDayContext({
      workweek: { workdays: [1, 2, 3, 4, 5] },
      pto: [],
      holidays: { regions: [], overrides: [] },
      holidayDates: [],
    });

    const effectiveWorkingDays = countEffectiveWorkingDays({
      from: new Date('2026-04-25T00:00:00'),
      to: new Date('2026-04-26T00:00:00'),
      ctx,
    });
    expect(effectiveWorkingDays).toBe(0);

    const summary = summarizeAverageCommitsPerDay({
      totalCommits: 3,
      effectiveWorkingDays,
    });
    expect(summary.average).toBeNull();
    expect(summary.isRestWindow).toBe(true);
    expect(summary.totalCommits).toBe(3);
  });

  it('builds per-week trend points with commits/effective-day averages', () => {
    const ctx = buildOffDayContext({
      workweek: { workdays: [1, 2, 3, 4, 5] },
      pto: [],
      holidays: { regions: [], overrides: [] },
      holidayDates: [],
    });

    const trend = buildAverageCommitsTrend({
      from: new Date('2026-04-19T00:00:00'),
      to: new Date('2026-05-02T00:00:00'),
      ctx,
      byDate: mapByDate({
        '2026-04-19': 1, // off-day commit still included
        '2026-04-20': 2,
        '2026-04-28': 3,
        '2026-05-02': 2, // off-day commit still included
      }),
    });

    expect(trend).toHaveLength(2);
    expect(trend[0]?.commits).toBe(3);
    expect(trend[0]?.effectiveWorkingDays).toBe(5);
    expect(trend[0]?.average).toBeCloseTo(0.6, 5);

    expect(trend[1]?.commits).toBe(5);
    expect(trend[1]?.effectiveWorkingDays).toBe(5);
    expect(trend[1]?.average).toBeCloseTo(1, 5);
  });

  it('uses per-working-day points when daily granularity is requested', () => {
    const ctx = buildOffDayContext({
      workweek: { workdays: [1, 2, 3, 4, 5] },
      pto: [],
      holidays: { regions: [], overrides: [] },
      holidayDates: [],
    });

    const trend = buildAverageCommitsTrend({
      from: new Date('2026-04-20T00:00:00'),
      to: new Date('2026-04-26T00:00:00'),
      ctx,
      granularity: 'daily',
      byDate: mapByDate({
        '2026-04-20': 2,
        '2026-04-22': 1,
        '2026-04-25': 4, // weekend commit should not become its own point
      }),
    });

    expect(trend).toHaveLength(5);
    expect(trend.every((p) => p.from === p.to)).toBe(true);
    expect(trend.every((p) => p.effectiveWorkingDays === 1)).toBe(true);
    expect(trend.every((p) => p.highlightDates.length === 1 && p.highlightDates[0] === p.from)).toBe(true);
    expect(trend.map((p) => p.from)).not.toContain('2026-04-25');
    expect(trend.map((p) => p.from)).not.toContain('2026-04-26');
  });

  it('keeps weekly points by default even for short windows', () => {
    const ctx = buildOffDayContext({
      workweek: { workdays: [1, 2, 3, 4, 5] },
      pto: [],
      holidays: { regions: [], overrides: [] },
      holidayDates: [],
    });

    const trend = buildAverageCommitsTrend({
      from: new Date('2026-04-20T00:00:00'),
      to: new Date('2026-04-26T00:00:00'),
      ctx,
      byDate: mapByDate({
        '2026-04-20': 2,
        '2026-04-22': 1,
      }),
    });

    expect(trend).toHaveLength(2);
    expect(trend.every((p) => p.label.startsWith('w'))).toBe(true);
  });

  it('uses weekly points for windows longer than last week', () => {
    const ctx = buildOffDayContext({
      workweek: { workdays: [1, 2, 3, 4, 5] },
      pto: [],
      holidays: { regions: [], overrides: [] },
      holidayDates: [],
    });

    const trend = buildAverageCommitsTrend({
      from: new Date('2026-01-01T00:00:00'),
      to: new Date('2026-06-30T00:00:00'),
      ctx,
      byDate: mapByDate({}),
    });

    expect(trend.length).toBeGreaterThan(20);
    expect(trend.every((p) => p.label.startsWith('w'))).toBe(true);
    expect(trend.every((p) => p.highlightDates.every((d) => d >= p.from && d <= p.to))).toBe(true);
  });
});
