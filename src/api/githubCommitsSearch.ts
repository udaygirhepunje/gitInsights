import type { Octokit } from '@octokit/rest';
import { RequestError } from '@octokit/request-error';

import type { MonthChunk } from './commitCache';
import { classifyError } from './errors';
import { enqueueSearchCommits, pauseAfterSearchFailure } from './searchQueue';

const COMMITS_PAGE_SIZE = 100;
export const COMMITS_SEARCH_HARD_CAP = 1000;
const COMMITS_MAX_PAGES = COMMITS_SEARCH_HARD_CAP / COMMITS_PAGE_SIZE;

function isoDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function midpointDate(a: Date, b: Date): Date {
  return new Date(a.getTime() + Math.floor((b.getTime() - a.getTime()) / 2));
}

function addOneDay(d: Date): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + 1);
  return next;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function monthKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** First of month .. last of month (local calendar). */
export function boundsForMonthKey(monthKey: string): { from: Date; to: Date } {
  const [ys, ms] = monthKey.split('-');
  const y = Number(ys);
  const m = Number(ms);
  const from = new Date(y, m - 1, 1);
  from.setHours(0, 0, 0, 0);
  const to = new Date(y, m, 0);
  to.setHours(0, 0, 0, 0);
  return { from, to };
}

/** Sorted ascending YYYY-MM — every month overlapping [from, to] inclusive (local dates). */
export function monthsOverlappingRange(from: Date | string, to: Date | string): string[] {
  const a = from instanceof Date ? new Date(from) : new Date(from);
  const b = to instanceof Date ? new Date(to) : new Date(to);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  const out: string[] = [];
  const cur = new Date(a.getFullYear(), a.getMonth(), 1);
  const endMonth = new Date(b.getFullYear(), b.getMonth(), 1);
  while (cur <= endMonth) {
    out.push(monthKeyFromDate(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

/** Same calendar months as {@link monthsOverlappingRange}, ordered **newest first** (for foreground loads). */
export function monthsOverlappingRangeDescending(
  from: Date | string,
  to: Date | string,
): string[] {
  return [...monthsOverlappingRange(from, to)].reverse();
}

/** Current month first, then older — `count` total months. */
export function trailingMonthKeysDescending(count: number, now = new Date()): string[] {
  const keys: string[] = [];
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  for (let i = 0; i < count; i += 1) {
    keys.push(monthKeyFromDate(d));
    d.setMonth(d.getMonth() - 1);
  }
  return keys;
}

export type SearchCommitsInRangeResult = {
  byDate: Record<string, number>;
  timestamps: string[];
  truncated: boolean;
};

/** Paginated + bisected search/commits for [since, until] (local date bounds). */
export async function searchCommitsInDateRange(
  rest: Octokit,
  login: string,
  since: Date,
  until: Date,
  priority: 'foreground' | 'backfill',
): Promise<SearchCommitsInRangeResult> {
  const byDate: Record<string, number> = {};
  const timestamps: string[] = [];
  let truncated = false;

  const ingest = (items: Array<{ commit: { author: { date?: string | null } | null } }>) => {
    for (const item of items) {
      const date = item.commit.author?.date;
      if (!date) continue;
      const dateKey = date.slice(0, 10);
      byDate[dateKey] = (byDate[dateKey] ?? 0) + 1;
      timestamps.push(date);
    }
  };

  const runSearchPage = async (page: number, q: string) =>
    enqueueSearchCommits(priority, () =>
      rest.search.commits({
        q,
        per_page: COMMITS_PAGE_SIZE,
        page,
        sort: 'author-date',
        order: 'desc',
      }),
    );

  const fetchRange = async (rangeSince: Date, rangeUntil: Date): Promise<void> => {
    const sinceIso = isoDateOnly(rangeSince);
    const untilIso = isoDateOnly(rangeUntil);
    const q = `author:${login} author-date:${sinceIso}..${untilIso} merge:false`;

    let firstPage;
    try {
      firstPage = await runSearchPage(1, q);
    } catch (err) {
      if (err instanceof RequestError) {
        const info = classifyError(err);
        if (info.kind === 'rate-limit') pauseAfterSearchFailure(err);
      }
      throw err;
    }

    const totalCount = firstPage.data.total_count ?? 0;

    if (totalCount > COMMITS_SEARCH_HARD_CAP && !isSameDay(rangeSince, rangeUntil)) {
      const mid = midpointDate(rangeSince, rangeUntil);
      await fetchRange(rangeSince, mid);
      await fetchRange(addOneDay(mid), rangeUntil);
      return;
    }

    if (totalCount > COMMITS_SEARCH_HARD_CAP) truncated = true;

    ingest(firstPage.data.items);
    const totalPages = Math.min(
      COMMITS_MAX_PAGES,
      Math.ceil(Math.min(totalCount, COMMITS_SEARCH_HARD_CAP) / COMMITS_PAGE_SIZE),
    );

    for (let page = 2; page <= totalPages; page += 1) {
      try {
        const next = await runSearchPage(page, q);
        ingest(next.data.items);
      } catch (err) {
        if (err instanceof RequestError) {
          const info = classifyError(err);
          if (info.kind === 'rate-limit') pauseAfterSearchFailure(err);
        }
        throw err;
      }
    }
  };

  await fetchRange(since, until);

  return { byDate, timestamps, truncated };
}

export function chunkFromSearchResult(
  login: string,
  monthKey: string,
  data: SearchCommitsInRangeResult,
  sealed: boolean,
): MonthChunk {
  return {
    month: monthKey,
    login,
    byDate: data.byDate,
    timestamps: data.timestamps,
    fetchedAt: new Date().toISOString(),
    sealed,
    truncated: data.truncated,
  };
}
