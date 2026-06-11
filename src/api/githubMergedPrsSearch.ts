import type { Octokit } from '@octokit/rest';
import { RequestError } from '@octokit/request-error';

import type { CachedMergedPrEntry, MergedPrMonthChunk } from './prMergeCache';
import { classifyError, toGitHubApiError } from './errors';

const PR_SEARCH_PAGE_SIZE = 100;
export const PR_SEARCH_HARD_CAP = 1000;
const PR_MAX_PAGES = PR_SEARCH_HARD_CAP / PR_SEARCH_PAGE_SIZE;

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

function parseRepoFullName(repositoryUrl?: string): string {
  if (!repositoryUrl) return '(repository unknown)';
  try {
    const u = new URL(repositoryUrl);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return '(repository unknown)';
    const owner = parts[parts.length - 2];
    const repo = parts[parts.length - 1];
    if (!owner || !repo) return '(repository unknown)';
    return `${owner}/${repo}`;
  } catch {
    return '(repository unknown)';
  }
}

function firstLine(title: string | null | undefined): string {
  const raw = typeof title === 'string' ? title : '';
  const line = raw.split(/\r?\n/, 1)[0] ?? '';
  const trimmed = line.trim();
  return trimmed.length > 0 ? trimmed : '(no title)';
}

type SearchIssuePrItem = {
  id: number;
  number: number;
  title?: string | null;
  html_url?: string | null;
  repository_url?: string | null;
  pull_request?: {
    merged_at?: string | null;
  } | null;
};

export type SearchMergedPrsInRangeResult = {
  byDate: Record<string, number>;
  prs: CachedMergedPrEntry[];
  truncated: boolean;
};

export function buildMergedPrsQuery(login: string, since: Date, until: Date): string {
  const sinceIso = isoDateOnly(since);
  const untilIso = isoDateOnly(until);
  // Co-authored attribution is explicitly out of scope; we only count authored PRs.
  return `type:pr author:${login} is:merged merged:${sinceIso}..${untilIso}`;
}

export async function searchMergedPrsInDateRange(
  rest: Octokit,
  login: string,
  since: Date,
  until: Date,
): Promise<SearchMergedPrsInRangeResult> {
  const byDate: Record<string, number> = {};
  const prs: CachedMergedPrEntry[] = [];
  const seenIds = new Set<number>();
  let truncated = false;

  const ingest = (items: SearchIssuePrItem[]) => {
    for (const item of items) {
      const mergedAt = item.pull_request?.merged_at;
      if (!mergedAt) continue;
      if (seenIds.has(item.id)) continue;
      seenIds.add(item.id);
      const dateKey = mergedAt.slice(0, 10);

      byDate[dateKey] = (byDate[dateKey] ?? 0) + 1;
      prs.push({
        id: item.id,
        number: item.number,
        repoFullName: parseRepoFullName(item.repository_url ?? undefined),
        title: firstLine(item.title),
        mergedAt,
        htmlUrl: item.html_url?.trim() || '',
      });
    }
  };

  const runSearchPage = async (page: number, q: string) => {
    try {
      return await rest.search.issuesAndPullRequests({
        q,
        per_page: PR_SEARCH_PAGE_SIZE,
        page,
        sort: 'updated',
        order: 'desc',
      });
    } catch (err) {
      if (err instanceof RequestError) {
        const info = classifyError(err);
        if (info.kind === 'rate-limit') throw toGitHubApiError(err);
      }
      throw toGitHubApiError(err);
    }
  };

  const fetchRange = async (rangeSince: Date, rangeUntil: Date): Promise<void> => {
    const q = buildMergedPrsQuery(login, rangeSince, rangeUntil);
    const firstPage = await runSearchPage(1, q);
    const totalCount = firstPage.data.total_count ?? 0;

    if (totalCount > PR_SEARCH_HARD_CAP && !isSameDay(rangeSince, rangeUntil)) {
      const mid = midpointDate(rangeSince, rangeUntil);
      await fetchRange(rangeSince, mid);
      await fetchRange(addOneDay(mid), rangeUntil);
      return;
    }

    if (totalCount > PR_SEARCH_HARD_CAP) truncated = true;

    ingest(firstPage.data.items as SearchIssuePrItem[]);
    const totalPages = Math.min(
      PR_MAX_PAGES,
      Math.ceil(Math.min(totalCount, PR_SEARCH_HARD_CAP) / PR_SEARCH_PAGE_SIZE),
    );

    for (let page = 2; page <= totalPages; page += 1) {
      const next = await runSearchPage(page, q);
      ingest(next.data.items as SearchIssuePrItem[]);
    }
  };

  await fetchRange(since, until);
  prs.sort((a, b) => Date.parse(b.mergedAt) - Date.parse(a.mergedAt));
  return { byDate, prs, truncated };
}

export function chunkFromMergedPrSearchResult(
  login: string,
  monthKey: string,
  data: SearchMergedPrsInRangeResult,
): MergedPrMonthChunk {
  return {
    month: monthKey,
    login,
    byDate: data.byDate,
    prs: data.prs,
    latestMergedAt: data.prs[0]?.mergedAt ?? null,
    fetchedAt: new Date().toISOString(),
    truncated: data.truncated,
  };
}
