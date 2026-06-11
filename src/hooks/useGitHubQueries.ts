import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type UseInfiniteQueryResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { loadAllCachedChunks, refreshStaleMonths } from '../api/commitsByDayRange';
import type { CommitsByDay } from '../api/commitsByDayRange';
import {
  loadAllCachedMergedPrChunks,
  refreshMergedPrsAuthoredMonths,
  type MergedPrsAuthoredCount,
} from '../api/mergedPrsByMonthRange';
import { listCachedPrMonths } from '../api/prMergeCache';
import { monthsOverlappingRange } from '../api/githubCommitsSearch';
import {
  COMMIT_HISTORY_DEFAULT_CAP,
  COMMIT_PAGE_SIZE,
  makeRepoCommitHistoryFetcher,
  makeRepoLanguagesFetcher,
  makeViewerContributionsFetcher,
  makeViewerOrgsFetcher,
  makeViewerProfileFetcher,
  makeViewerRepoLanguagesFetcher,
  type CommitHistoryPage,
  type GitHubClients,
} from '../api/github';
import { queryKeys, STALE_TIMES } from '../api/queryClient';
import { useGitHub } from './useGitHub';

// Thin TanStack Query wrappers around `api/github.ts` fetchers. All hooks gate
// on `useGitHub()` (no token → no fetch), use centralised query keys, and pick
// a staleTime from spec §3.D. Query keys include resolved {from, to} so
// switching timeframes is a cache lookup, not a refetch, on repeat selections.

function requireClients(clients: GitHubClients | null): GitHubClients {
  if (!clients) throw new Error('useGitHub_no_token');
  return clients;
}

export function useViewerProfile(): UseQueryResult<
  Awaited<ReturnType<ReturnType<typeof makeViewerProfileFetcher>>>
> {
  const clients = useGitHub();
  return useQuery({
    queryKey: queryKeys.viewer(),
    queryFn: () => makeViewerProfileFetcher(requireClients(clients))(),
    enabled: clients != null,
    staleTime: STALE_TIMES.viewer,
  });
}

export type ContributionsRange = { from: Date | string; to: Date | string };

function rangeKey(range: ContributionsRange): { from: string; to: string } {
  const from = range.from instanceof Date ? range.from.toISOString() : range.from;
  const to = range.to instanceof Date ? range.to.toISOString() : range.to;
  return { from, to };
}

export function useViewerContributions(
  range: ContributionsRange,
): UseQueryResult<Awaited<ReturnType<ReturnType<typeof makeViewerContributionsFetcher>>>> {
  const clients = useGitHub();
  const key = rangeKey(range);
  return useQuery({
    queryKey: queryKeys.viewerContributions(key.from, key.to),
    queryFn: () => makeViewerContributionsFetcher(requireClients(clients))(range),
    enabled: clients != null,
    staleTime: STALE_TIMES.contributions,
  });
}

// Pure non-merge commits per day — month-chunk cache + search queue.
//
// 2-phase stale-while-revalidate:
//   Phase 1 (queryFn): read all IDB chunks (instant, no network).
//   Phase 2 (useEffect): kick off background refresh for stale/missing months,
//     patching the query cache with progressively-complete snapshots.
export function useViewerCommitsByDay(args: {
  login: string | null | undefined;
  range: ContributionsRange;
}): UseQueryResult<CommitsByDay> {
  const clients = useGitHub();
  const queryClient = useQueryClient();
  const key = rangeKey(args.range);
  const login = args.login ?? '';
  const qk = queryKeys.viewerCommitsByDay(login, key.from, key.to);

  // Refs for values the background effect needs without being in its deps.
  const qkRef = useRef(qk);
  qkRef.current = qk;
  const clientsRef = useRef(clients);
  clientsRef.current = clients;
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  const rangeFrom = args.range.from;
  const rangeTo = args.range.to;

  const result = useQuery({
    queryKey: qk,
    queryFn: async () => {
      const cached = await loadAllCachedChunks(login, rangeFrom, rangeTo);
      if (cached) return cached;
      const fromDate = new Date(typeof rangeFrom === 'string' ? rangeFrom : rangeFrom);
      const toDate = new Date(typeof rangeTo === 'string' ? rangeTo : rangeTo);
      fromDate.setHours(0, 0, 0, 0);
      toDate.setHours(0, 0, 0, 0);
      const fromIso = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}-${String(fromDate.getDate()).padStart(2, '0')}`;
      const toIso = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, '0')}-${String(toDate.getDate()).padStart(2, '0')}`;
      const totalMonths = monthsOverlappingRange(fromDate, toDate).length;
      return {
        byDate: {},
        totalCommits: 0,
        fromIso,
        toIso,
        truncated: false,
        timestamps: [],
        cachedMonths: [],
        totalMonths,
      } satisfies CommitsByDay;
    },
    enabled: login.length > 0,
    staleTime: STALE_TIMES.commitsByDay,
  });

  // Phase 2: background refresh.
  // Only depends on (login, rangeFrom, rangeTo) — the actual identity inputs.
  // clients / queryClient / qk are read via refs so they never re-trigger the effect.
  // refreshStaleMonths has its own module-level mutex (activeRefreshId) so even
  // React Strict Mode double-fire is harmless.
  useEffect(() => {
    if (!login) return;

    const kick = () => {
      const c = clientsRef.current;
      if (!c) return;
      void refreshStaleMonths(c, login, rangeFrom, rangeTo, {
        staleMs: STALE_TIMES.commitsByDay,
        onSnapshot: (snapshot) => {
          queryClientRef.current.setQueryData(qkRef.current, snapshot);
        },
      });
    };

    kick();
  }, [login, rangeFrom, rangeTo]);

  return result;
}

export function useViewerMergedPrsAuthored(args: {
  login: string | null | undefined;
  range: ContributionsRange;
}): UseQueryResult<MergedPrsAuthoredCount> {
  const clients = useGitHub();
  const queryClient = useQueryClient();
  const key = rangeKey(args.range);
  const login = args.login ?? '';
  const qk = queryKeys.viewerMergedPrsAuthored(login, key.from, key.to);

  const qkRef = useRef(qk);
  qkRef.current = qk;

  const rangeFrom = args.range.from;
  const rangeTo = args.range.to;

  const result = useQuery({
    queryKey: qk,
    queryFn: async () => {
      const cached = await loadAllCachedMergedPrChunks(login, rangeFrom, rangeTo);
      if (cached) return cached;
      const fromDate = new Date(typeof rangeFrom === 'string' ? rangeFrom : rangeFrom);
      const toDate = new Date(typeof rangeTo === 'string' ? rangeTo : rangeTo);
      fromDate.setHours(0, 0, 0, 0);
      toDate.setHours(0, 0, 0, 0);
      const fromIso = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}-${String(fromDate.getDate()).padStart(2, '0')}`;
      const toIso = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, '0')}-${String(toDate.getDate()).padStart(2, '0')}`;
      return {
        total: 0,
        byDate: {},
        fromIso,
        toIso,
        truncated: false,
        exact: true,
        cachedMonths: [],
        totalMonths: monthsOverlappingRange(fromDate, toDate).length,
      } satisfies MergedPrsAuthoredCount;
    },
    enabled: login.length > 0,
    staleTime: STALE_TIMES.mergedPrsAuthored,
  });

  useEffect(() => {
    if (!login || !clients) return;

    const controller = new AbortController();
    const targetQk = qkRef.current;

    const kick = async () => {
      const hadAnyCacheBefore = (await listCachedPrMonths(login)).length > 0;

      // Pass 1: keep current timeframe accurate and reactive.
      await refreshMergedPrsAuthoredMonths(clients, login, rangeFrom, rangeTo, {
        staleMs: STALE_TIMES.mergedPrsAuthored,
        signal: controller.signal,
        onSnapshot: (snapshot) => {
          queryClient.setQueryData(targetQk, snapshot);
        },
      });

      // Pass 2: first-time warmup — backfill full 12 months so timeframe
      // switches are instant after initial load.
      if (hadAnyCacheBefore || controller.signal.aborted) return;

      const warmTo = new Date(typeof rangeTo === 'string' ? rangeTo : rangeTo);
      warmTo.setHours(0, 0, 0, 0);
      const warmFrom = new Date(warmTo);
      warmFrom.setDate(warmFrom.getDate() - 365);
      warmFrom.setHours(0, 0, 0, 0);

      await refreshMergedPrsAuthoredMonths(clients, login, warmFrom, warmTo, {
        staleMs: STALE_TIMES.mergedPrsAuthored,
        signal: controller.signal,
      });
    };

    void kick();
    return () => controller.abort();
  }, [clients, login, queryClient, rangeFrom, rangeTo]);

  return result;
}

export function useViewerOrgs(): UseQueryResult<
  Awaited<ReturnType<ReturnType<typeof makeViewerOrgsFetcher>>>
> {
  const clients = useGitHub();
  return useQuery({
    queryKey: queryKeys.viewerOrgs(),
    queryFn: () => makeViewerOrgsFetcher(requireClients(clients))(),
    enabled: clients != null,
    staleTime: STALE_TIMES.repoMetadata,
  });
}

export type RepoCommitHistoryArgs = {
  owner: string;
  name: string;
  since?: Date | string;
  until?: Date | string;
  // Total commit cap across all pages (spec §3.D — default 5,000). Pages stop
  // either when GitHub says `hasNextPage = false` or when `commits.length`
  // reaches this cap.
  cap?: number;
};

function isoOrUndefined(v: Date | string | undefined): string | undefined {
  if (v === undefined) return undefined;
  return v instanceof Date ? v.toISOString() : v;
}

export function useRepoCommitHistory(
  args: RepoCommitHistoryArgs,
): UseInfiniteQueryResult<{ pages: CommitHistoryPage[]; pageParams: (string | null)[] }> {
  const clients = useGitHub();
  const since = isoOrUndefined(args.since);
  const until = isoOrUndefined(args.until);
  const cap = args.cap ?? COMMIT_HISTORY_DEFAULT_CAP;

  return useInfiniteQuery({
    queryKey: queryKeys.repoCommitHistory(args.owner, args.name, since, until),
    enabled: clients != null,
    staleTime: STALE_TIMES.commitHistory,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      makeRepoCommitHistoryFetcher(requireClients(clients))({
        owner: args.owner,
        name: args.name,
        since,
        until,
        after: pageParam ?? undefined,
        first: COMMIT_PAGE_SIZE,
      }),
    getNextPageParam: (lastPage, allPages) => {
      const fetched = allPages.reduce((sum, p) => sum + p.commits.length, 0);
      if (fetched >= cap) return undefined;
      return lastPage.pageInfo.hasNextPage ? lastPage.pageInfo.endCursor : undefined;
    },
  });
}

export function useViewerRepoLanguages(): UseQueryResult<
  Awaited<ReturnType<ReturnType<typeof makeViewerRepoLanguagesFetcher>>>
> {
  const clients = useGitHub();
  return useQuery({
    queryKey: queryKeys.viewerRepoLanguages(),
    queryFn: () => makeViewerRepoLanguagesFetcher(requireClients(clients))(),
    enabled: clients != null,
    staleTime: STALE_TIMES.repoMetadata,
  });
}

export function useRepoLanguages(args: { owner: string; name: string }): UseQueryResult<
  Awaited<ReturnType<ReturnType<typeof makeRepoLanguagesFetcher>>>
> {
  const clients = useGitHub();
  return useQuery({
    queryKey: queryKeys.repoLanguages(args.owner, args.name),
    queryFn: () => makeRepoLanguagesFetcher(requireClients(clients))(args),
    enabled: clients != null,
    staleTime: STALE_TIMES.repoMetadata,
  });
}
