import { describe, expect, it } from 'vitest';

import { resolveAverageCommitsPerDayTileState } from '../averageCommitsPerDayModel';

describe('resolveAverageCommitsPerDayTileState', () => {
  it('returns error when query failed and no data exists', () => {
    const state = resolveAverageCommitsPerDayTileState({
      hasData: false,
      isLoading: false,
      isError: true,
      totalCommits: 0,
      effectiveWorkingDays: 0,
    });
    expect(state).toBe('error');
  });

  it('returns loading when query is still in flight', () => {
    const state = resolveAverageCommitsPerDayTileState({
      hasData: false,
      isLoading: true,
      isError: false,
      totalCommits: 0,
      effectiveWorkingDays: 0,
    });
    expect(state).toBe('loading');
  });

  it('keeps denominator=0 as loaded rest-window state (not empty)', () => {
    const state = resolveAverageCommitsPerDayTileState({
      hasData: true,
      isLoading: false,
      isError: false,
      totalCommits: 0,
      effectiveWorkingDays: 0,
    });
    expect(state).toBe('loaded');
  });

  it('returns empty only when denominator is positive and commits are zero', () => {
    const state = resolveAverageCommitsPerDayTileState({
      hasData: true,
      isLoading: false,
      isError: false,
      totalCommits: 0,
      effectiveWorkingDays: 12,
    });
    expect(state).toBe('empty');
  });

  it('returns loaded when commits exist and denominator is positive', () => {
    const state = resolveAverageCommitsPerDayTileState({
      hasData: true,
      isLoading: false,
      isError: false,
      totalCommits: 18,
      effectiveWorkingDays: 9,
    });
    expect(state).toBe('loaded');
  });
});
