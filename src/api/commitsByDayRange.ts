import type { Octokit } from '@octokit/rest';

import { STALE_TIMES } from './queryClient';
import { getChunk, isMonthSealed, setChunk, type MonthChunk } from './commitCache';
import {
  boundsForMonthKey,
  chunkFromSearchResult,
  monthsOverlappingRangeDescending,
  searchCommitsInDateRange,
} from './githubCommitsSearch';

export type CommitsCoverage = {
  totalMonths: number;
  loadedMonths: number;
  backfilling: boolean;
  loadedMonthKeys: string[];
};

export type CommitsByDay = {
  byDate: Record<string, number>;
  totalCommits: number;
  fromIso: string;
  toIso: string;
  truncated: boolean;
  timestamps: string[];
  coverage?: CommitsCoverage;
};

export type GitHubClientsLite = {
  rest: Octokit;
};

const DEFAULT_STALE_MS = STALE_TIMES.commitsByDay;

function mergeChunks(
  chunks: MonthChunk[],
  fromIso: string,
  toIso: string,
  coverage: CommitsCoverage,
): CommitsByDay {
  const byDate: Record<string, number> = {};
  const timestamps: string[] = [];
  let truncated = false;
  let totalCommits = 0;

  for (const c of chunks) {
    truncated ||= c.truncated;
    for (const [d, n] of Object.entries(c.byDate)) {
      if (d < fromIso || d > toIso) continue;
      byDate[d] = (byDate[d] ?? 0) + n;
    }
    for (const t of c.timestamps) {
      const day = t.slice(0, 10);
      if (day < fromIso || day > toIso) continue;
      timestamps.push(t);
    }
  }

  for (const d of Object.keys(byDate)) {
    if (d >= fromIso && d <= toIso) totalCommits += byDate[d] ?? 0;
  }

  return {
    byDate,
    totalCommits,
    fromIso,
    toIso,
    truncated,
    timestamps,
    coverage,
  };
}

async function fetchAndStoreMonth(
  clients: GitHubClientsLite,
  login: string,
  monthKey: string,
  priority: 'foreground' | 'backfill',
): Promise<MonthChunk> {
  const { from, to } = boundsForMonthKey(monthKey);
  const data = await searchCommitsInDateRange(clients.rest, login, from, to, priority);
  const sealed = isMonthSealed(monthKey);
  const chunk = chunkFromSearchResult(login, monthKey, data, sealed);
  await setChunk(chunk);
  return chunk;
}

async function loadOrFetchMonth(
  clients: GitHubClientsLite,
  login: string,
  monthKey: string,
  priority: 'foreground' | 'backfill',
  staleMs: number,
): Promise<MonthChunk> {
  const existing = await getChunk(login, monthKey);
  const sealed = isMonthSealed(monthKey);
  if (existing && sealed) return existing;
  if (existing && !sealed) {
    const age = Date.now() - Date.parse(existing.fetchedAt);
    if (Number.isFinite(age) && age >= 0 && age < staleMs) return existing;
  }
  return fetchAndStoreMonth(clients, login, monthKey, priority);
}

export async function ensureCommitsByDayRange(
  clients: GitHubClientsLite,
  login: string,
  from: Date | string,
  to: Date | string,
  opts: {
    priority: 'foreground' | 'backfill';
    staleMs?: number;
    signal?: AbortSignal;
    onPartial?: (data: CommitsByDay) => void;
  },
): Promise<CommitsByDay> {
  const staleMs = opts.staleMs ?? DEFAULT_STALE_MS;
  const fromDate = from instanceof Date ? new Date(from) : new Date(from);
  const toDate = to instanceof Date ? new Date(to) : new Date(to);
  fromDate.setHours(0, 0, 0, 0);
  toDate.setHours(0, 0, 0, 0);

  const fromIso = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}-${String(fromDate.getDate()).padStart(2, '0')}`;
  const toIso = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, '0')}-${String(toDate.getDate()).padStart(2, '0')}`;

  const monthKeys = monthsOverlappingRangeDescending(fromDate, toDate);
  const chunks: MonthChunk[] = [];

  for (const monthKey of monthKeys) {
    if (opts.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const chunk = await loadOrFetchMonth(clients, login, monthKey, opts.priority, staleMs);
    chunks.push(chunk);

    const coverage: CommitsCoverage = {
      totalMonths: monthKeys.length,
      loadedMonths: chunks.length,
      loadedMonthKeys: chunks.map((c) => c.month).sort(),
      backfilling: chunks.length < monthKeys.length,
    };
    opts.onPartial?.(mergeChunks(chunks, fromIso, toIso, coverage));
  }

  const coverage: CommitsCoverage = {
    totalMonths: monthKeys.length,
    loadedMonths: chunks.length,
    loadedMonthKeys: chunks.map((c) => c.month).sort(),
    backfilling: false,
  };

  return mergeChunks(chunks, fromIso, toIso, coverage);
}

export type PrefetchMonthResult = {
  chunk: MonthChunk | null;
  /** True when this call hit GitHub (new month or stale unsealed refresh). */
  didNetworkFetch: boolean;
};

/**
 * Backfill helper: load a month from cache when sealed/fresh; otherwise fetch.
 * Callers should only invalidate `commitsByDay` React Query when `didNetworkFetch` is true —
 * otherwise periodic backfill would re-run the full query every ~15s for no reason.
 */
export async function prefetchMonthIfMissing(
  clients: GitHubClientsLite,
  login: string,
  monthKey: string,
  priority: 'foreground' | 'backfill',
): Promise<PrefetchMonthResult> {
  const existing = await getChunk(login, monthKey);
  if (existing && isMonthSealed(monthKey)) {
    return { chunk: existing, didNetworkFetch: false };
  }
  if (existing && !isMonthSealed(monthKey)) {
    const age = Date.now() - Date.parse(existing.fetchedAt);
    if (Number.isFinite(age) && age >= 0 && age < DEFAULT_STALE_MS) {
      return { chunk: existing, didNetworkFetch: false };
    }
  }
  try {
    const chunk = await fetchAndStoreMonth(clients, login, monthKey, priority);
    return { chunk, didNetworkFetch: true };
  } catch {
    return { chunk: null, didNetworkFetch: false };
  }
}
