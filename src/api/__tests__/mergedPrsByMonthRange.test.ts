import { describe, expect, it } from 'vitest';

import type { MergedPrMonthChunk } from '../prMergeCache';
import {
  aggregateMergedPrChunks,
  mergePrMonthChunk,
} from '../mergedPrsByMonthRange';

describe('mergePrMonthChunk', () => {
  it('dedupes PR ids and keeps truncated sticky', () => {
    const existing: MergedPrMonthChunk = {
      month: '2026-01',
      login: 'alice',
      byDate: { '2026-01-10': 1 },
      prs: [
        {
          id: 1,
          number: 10,
          repoFullName: 'acme/api',
          title: 'feat: tile',
          mergedAt: '2026-01-10T10:00:00Z',
          htmlUrl: 'https://github.com/acme/api/pull/10',
        },
      ],
      latestMergedAt: '2026-01-10T10:00:00Z',
      fetchedAt: '2026-01-10T11:00:00Z',
      truncated: true,
    };

    const merged = mergePrMonthChunk(existing, {
      byDate: { '2026-01-10': 1, '2026-01-11': 1 },
      prs: [
        {
          id: 1,
          number: 10,
          repoFullName: 'acme/api',
          title: 'feat: tile',
          mergedAt: '2026-01-10T10:00:00Z',
          htmlUrl: 'https://github.com/acme/api/pull/10',
        },
        {
          id: 2,
          number: 11,
          repoFullName: 'acme/web',
          title: 'fix: cache',
          mergedAt: '2026-01-11T10:00:00Z',
          htmlUrl: 'https://github.com/acme/web/pull/11',
        },
      ],
      truncated: false,
    });

    expect(merged.prs).toHaveLength(2);
    expect(merged.latestMergedAt).toBe('2026-01-11T10:00:00Z');
    expect(merged.byDate).toEqual({
      '2026-01-10': 1,
      '2026-01-11': 1,
    });
    expect(merged.truncated).toBe(true);
  });
});

describe('aggregateMergedPrChunks', () => {
  it('sums only days inside range and marks exact false when truncated', () => {
    const chunkA: MergedPrMonthChunk = {
      month: '2026-01',
      login: 'alice',
      byDate: {
        '2026-01-05': 2,
        '2026-01-30': 1,
      },
      prs: [],
      latestMergedAt: null,
      fetchedAt: '2026-01-31T00:00:00Z',
      truncated: false,
    };
    const chunkB: MergedPrMonthChunk = {
      month: '2026-02',
      login: 'alice',
      byDate: {
        '2026-02-01': 3,
        '2026-02-02': 2,
      },
      prs: [],
      latestMergedAt: null,
      fetchedAt: '2026-02-03T00:00:00Z',
      truncated: true,
    };

    const result = aggregateMergedPrChunks(
      [chunkA, chunkB],
      '2026-01-30',
      '2026-02-01',
      ['2026-02', '2026-01'],
      2,
    );

    expect(result.total).toBe(4);
    expect(result.byDate).toEqual({
      '2026-01-30': 1,
      '2026-02-01': 3,
    });
    expect(result.truncated).toBe(true);
    expect(result.exact).toBe(false);
  });
});
