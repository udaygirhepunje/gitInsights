import type { Octokit } from '@octokit/rest';
import { describe, expect, it, vi } from 'vitest';

import {
  buildMergedPrsQuery,
  searchMergedPrsInDateRange,
} from '../githubMergedPrsSearch';

function makeRestMock(
  impl: (args: { q: string; per_page: number; page: number }) => Promise<unknown>,
): Octokit {
  return {
    search: {
      issuesAndPullRequests: vi.fn(impl),
    },
  } as unknown as Octokit;
}

describe('buildMergedPrsQuery', () => {
  it('builds authored + merged search query', () => {
    const q = buildMergedPrsQuery('alice', new Date(2026, 0, 1), new Date(2026, 0, 31));
    expect(q).toBe('type:pr author:alice is:merged merged:2026-01-01..2026-01-31');
  });
});

describe('searchMergedPrsInDateRange', () => {
  it('aggregates merged PRs by day and dedupes by id', async () => {
    const rest = makeRestMock(async () => ({
      data: {
        total_count: 3,
        items: [
          {
            id: 1,
            number: 10,
            title: 'feat: tile',
            html_url: 'https://github.com/acme/api/pull/10',
            repository_url: 'https://api.github.com/repos/acme/api',
            pull_request: { merged_at: '2026-01-10T10:00:00Z' },
          },
          {
            id: 1,
            number: 10,
            title: 'feat: tile',
            html_url: 'https://github.com/acme/api/pull/10',
            repository_url: 'https://api.github.com/repos/acme/api',
            pull_request: { merged_at: '2026-01-10T10:00:00Z' },
          },
          {
            id: 2,
            number: 11,
            title: 'fix: cache',
            html_url: 'https://github.com/acme/web/pull/11',
            repository_url: 'https://api.github.com/repos/acme/web',
            pull_request: { merged_at: '2026-01-11T12:00:00Z' },
          },
        ],
      },
    }));

    const res = await searchMergedPrsInDateRange(
      rest,
      'alice',
      new Date(2026, 0, 10),
      new Date(2026, 0, 11),
    );

    expect(res.truncated).toBe(false);
    expect(res.byDate).toEqual({
      '2026-01-10': 1,
      '2026-01-11': 1,
    });
    expect(res.prs).toHaveLength(2);
    expect(res.prs[0]?.id).toBe(2);

    const mock = rest.search.issuesAndPullRequests as unknown as ReturnType<typeof vi.fn>;
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock.mock.calls[0]?.[0].q).toContain('type:pr');
    expect(mock.mock.calls[0]?.[0].q).toContain('author:alice');
    expect(mock.mock.calls[0]?.[0].q).toContain('is:merged');
    expect(mock.mock.calls[0]?.[0].q).toContain('merged:2026-01-10..2026-01-11');
  });

  it('marks truncated when same-day range exceeds github cap', async () => {
    const rest = makeRestMock(async () => ({
      data: {
        total_count: 1205,
        items: [],
      },
    }));

    const res = await searchMergedPrsInDateRange(
      rest,
      'alice',
      new Date(2026, 0, 10),
      new Date(2026, 0, 10),
    );

    expect(res.truncated).toBe(true);
    const mock = rest.search.issuesAndPullRequests as unknown as ReturnType<typeof vi.fn>;
    expect(mock).toHaveBeenCalledTimes(10);
  });
});
