import type { Octokit } from '@octokit/rest';

import { STALE_TIMES } from './queryClient';
import {
  boundsForMonthKey,
  monthsOverlappingRangeDescending,
} from './githubCommitsSearch';
import {
  chunkFromMergedPrSearchResult,
  searchMergedPrsInDateRange,
  type SearchMergedPrsInRangeResult,
} from './githubMergedPrsSearch';
import type { CachedMergedPrEntry, MergedPrMonthChunk } from './prMergeCache';
import { getPrMonthChunk, setPrMonthChunk } from './prMergeCache';

export type MergedPrsAuthoredCount = {
  total: number;
  byDate: Record<string, number>;
  fromIso: string;
  toIso: string;
  truncated: boolean;
  exact: boolean;
  cachedMonths: string[];
  totalMonths: number;
};

export type GitHubClientsLite = {
  rest: Octokit;
};

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthSealed(monthKey: string, nowMs: number): boolean {
  const { to } = boundsForMonthKey(monthKey);
  const monthEnd = new Date(to);
  monthEnd.setHours(23, 59, 59, 999);
  const thirtyDaysAfterMonthEnd = new Date(monthEnd);
  thirtyDaysAfterMonthEnd.setDate(thirtyDaysAfterMonthEnd.getDate() + 30);
  return nowMs > thirtyDaysAfterMonthEnd.getTime();
}

function chunkAgeMs(chunk: MergedPrMonthChunk, nowMs: number): number {
  const fetchedAt = Date.parse(chunk.fetchedAt);
  if (!Number.isFinite(fetchedAt)) return Number.POSITIVE_INFINITY;
  return nowMs - fetchedAt;
}

function rebuildByDate(prs: CachedMergedPrEntry[]): Record<string, number> {
  const byDate: Record<string, number> = {};
  for (const pr of prs) {
    const day = pr.mergedAt.slice(0, 10);
    byDate[day] = (byDate[day] ?? 0) + 1;
  }
  return byDate;
}

export function mergePrMonthChunk(
  existing: MergedPrMonthChunk,
  incoming: SearchMergedPrsInRangeResult,
): MergedPrMonthChunk {
  const byId = new Map<number, CachedMergedPrEntry>();
  for (const pr of existing.prs) byId.set(pr.id, pr);
  for (const pr of incoming.prs) byId.set(pr.id, pr);
  const mergedPrs = [...byId.values()].sort((a, b) => Date.parse(b.mergedAt) - Date.parse(a.mergedAt));
  return {
    ...existing,
    byDate: rebuildByDate(mergedPrs),
    prs: mergedPrs,
    latestMergedAt: mergedPrs[0]?.mergedAt ?? existing.latestMergedAt,
    fetchedAt: new Date().toISOString(),
    truncated: existing.truncated || incoming.truncated,
  };
}

export function aggregateMergedPrChunks(
  chunks: MergedPrMonthChunk[],
  fromIso: string,
  toIso: string,
  cachedMonths: string[],
  totalMonths: number,
): MergedPrsAuthoredCount {
  const byDate: Record<string, number> = {};
  let total = 0;
  let truncated = false;

  for (const c of chunks) {
    truncated ||= c.truncated;
    for (const [day, count] of Object.entries(c.byDate)) {
      if (day < fromIso || day > toIso) continue;
      byDate[day] = (byDate[day] ?? 0) + count;
    }
  }

  for (const count of Object.values(byDate)) total += count;

  return {
    total,
    byDate,
    fromIso,
    toIso,
    truncated,
    exact: !truncated,
    cachedMonths,
    totalMonths,
  };
}

export async function loadAllCachedMergedPrChunks(
  login: string,
  from: Date | string,
  to: Date | string,
): Promise<MergedPrsAuthoredCount | null> {
  const fromDate = new Date(typeof from === 'string' ? from : from);
  const toDate = new Date(typeof to === 'string' ? to : to);
  fromDate.setHours(0, 0, 0, 0);
  toDate.setHours(0, 0, 0, 0);

  const fromIso = toIsoDate(fromDate);
  const toIso = toIsoDate(toDate);
  const monthKeys = monthsOverlappingRangeDescending(fromDate, toDate);

  const chunks: MergedPrMonthChunk[] = [];
  const cachedMonths: string[] = [];
  for (const month of monthKeys) {
    const cached = await getPrMonthChunk(login, month);
    if (!cached) continue;
    chunks.push(cached);
    cachedMonths.push(month);
  }
  if (chunks.length === 0) return null;
  return aggregateMergedPrChunks(chunks, fromIso, toIso, cachedMonths, monthKeys.length);
}

async function fetchMissingMonthChunk(
  clients: GitHubClientsLite,
  login: string,
  monthKey: string,
): Promise<MergedPrMonthChunk> {
  const { from, to } = boundsForMonthKey(monthKey);
  const data = await searchMergedPrsInDateRange(clients.rest, login, from, to);
  const chunk = chunkFromMergedPrSearchResult(login, monthKey, data);
  await setPrMonthChunk(chunk);
  return chunk;
}

async function refreshActiveMonthChunk(
  clients: GitHubClientsLite,
  login: string,
  monthKey: string,
  existing: MergedPrMonthChunk,
): Promise<MergedPrMonthChunk> {
  const { from, to } = boundsForMonthKey(monthKey);
  const since = existing.latestMergedAt ? new Date(existing.latestMergedAt) : from;
  since.setHours(0, 0, 0, 0);
  if (since > to) return existing;

  const incoming = await searchMergedPrsInDateRange(clients.rest, login, since, to);
  const next = mergePrMonthChunk(existing, incoming);
  await setPrMonthChunk(next);
  return next;
}

export async function refreshMergedPrsAuthoredMonths(
  clients: GitHubClientsLite,
  login: string,
  from: Date | string,
  to: Date | string,
  opts: {
    staleMs?: number;
    signal?: AbortSignal;
    onSnapshot?: (data: MergedPrsAuthoredCount) => void;
  },
): Promise<void> {
  const staleMs = opts.staleMs ?? STALE_TIMES.mergedPrsAuthored;
  const nowMs = Date.now();
  const fromDate = new Date(typeof from === 'string' ? from : from);
  const toDate = new Date(typeof to === 'string' ? to : to);
  fromDate.setHours(0, 0, 0, 0);
  toDate.setHours(0, 0, 0, 0);
  const fromIso = toIsoDate(fromDate);
  const toIso = toIsoDate(toDate);

  const monthKeys = monthsOverlappingRangeDescending(fromDate, toDate);
  const cached = new Map<string, MergedPrMonthChunk>();
  for (const month of monthKeys) {
    const chunk = await getPrMonthChunk(login, month);
    if (chunk) cached.set(month, chunk);
  }

  const monthsToRefresh: string[] = [];
  for (const month of monthKeys) {
    const chunk = cached.get(month);
    if (!chunk) {
      monthsToRefresh.push(month);
      continue;
    }
    if (monthSealed(month, nowMs)) continue;
    if (chunkAgeMs(chunk, nowMs) >= staleMs) monthsToRefresh.push(month);
  }

  if (monthsToRefresh.length === 0) return;

  for (const month of monthsToRefresh) {
    if (opts.signal?.aborted) return;
    const existing = cached.get(month);
    try {
      const refreshed = existing
        ? await refreshActiveMonthChunk(clients, login, month, existing)
        : await fetchMissingMonthChunk(clients, login, month);
      cached.set(month, refreshed);
    } catch {
      continue;
    }

    const allChunks = monthKeys.filter((m) => cached.has(m)).map((m) => cached.get(m)!);
    const cachedMonths = [...cached.keys()];
    opts.onSnapshot?.(
      aggregateMergedPrChunks(allChunks, fromIso, toIso, cachedMonths, monthKeys.length),
    );
  }
}
