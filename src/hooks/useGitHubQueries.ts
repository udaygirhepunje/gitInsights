import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type UseInfiniteQueryResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { ensureCommitsByDayRange } from '../api/commitsByDayRange';
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
  type CommitsByDay,
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

// Pure non-merge commits per day — month-chunk cache + search queue (spec §3.D.1).
export function useViewerCommitsByDay(args: {
  login: string | null | undefined;
  range: ContributionsRange;
}): UseQueryResult<CommitsByDay> {
  const clients = useGitHub();
  const queryClient = useQueryClient();
  const key = rangeKey(args.range);
  const login = args.login ?? '';
  const qk = queryKeys.viewerCommitsByDay(login, key.from, key.to);
  return useQuery({
    queryKey: qk,
    queryFn: ({ signal }) =>
      ensureCommitsByDayRange(requireClients(clients), login, args.range.from, args.range.to, {
        priority: 'foreground',
        staleMs: STALE_TIMES.commitsByDay,
        signal,
        onPartial: (partial) => {
          queryClient.setQueryData(qk, partial);
        },
      }),
    enabled: clients != null && login.length > 0,
    staleTime: STALE_TIMES.commitsByDay,
  });
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
