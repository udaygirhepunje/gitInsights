import { graphql as octokitGraphql } from '@octokit/graphql';
import { Octokit } from '@octokit/rest';

import { ensureCommitsByDayRange, type CommitsByDay } from './commitsByDayRange';
import {
  classifyError,
  detectRateLimit,
  GitHubApiError,
  toGitHubApiError,
} from './errors';
import { emitRateLimit } from './events';
import {
  REPO_COMMIT_HISTORY_QUERY,
  REPO_LANGUAGES_QUERY,
  VIEWER_CONTRIBUTIONS_QUERY,
  VIEWER_ORGS_QUERY,
  VIEWER_PROFILE_QUERY,
  VIEWER_REPO_LANGUAGES_QUERY,
  type RepoCommitHistory,
  type RepoLanguages,
  type ViewerContributions,
  type ViewerOrgs,
  type ViewerProfile,
  type ViewerRepoLanguages,
} from './queries';

export type GitHubClients = {
  graphql: ReturnType<typeof octokitGraphql.defaults>;
  rest: Octokit;
};

const USER_AGENT = 'gitInsights (https://github.com/)';

export function createGitHubClients(token: string): GitHubClients {
  const graphql = octokitGraphql.defaults({
    headers: {
      authorization: `bearer ${token}`,
      'user-agent': USER_AGENT,
    },
  });

  const rest = new Octokit({
    auth: token,
    userAgent: USER_AGENT,
  });

  return { graphql, rest };
}

// Wrap any data-layer call so the global rate-limit banner sees 403 events and
// callers always receive a typed `GitHubApiError`. Keep this private — the
// typed wrappers below are the public surface.
async function callWithErrorMapping<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const info = classifyError(err);
    if (info.kind === 'rate-limit') emitRateLimit(info);
    throw new GitHubApiError(info, err instanceof Error ? err.message : undefined);
  }
}

export type ViewerContributionsArgs = {
  from: Date | string;
  to: Date | string;
};

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

export type RepoCommitHistoryArgs = {
  owner: string;
  name: string;
  since?: Date | string;
  until?: Date | string;
  after?: string;
  // Spec §3.D: 5,000 commits per fetch ceiling. GraphQL caps each page at
  // 100, so pagination still uses `pageInfo`; `first` is the per-call cap
  // when callers stitch pages themselves.
  first?: number;
};

export const COMMIT_PAGE_SIZE = 100;
export const COMMIT_HISTORY_DEFAULT_CAP = 5000;

export function makeViewerProfileFetcher(clients: GitHubClients) {
  return () =>
    callWithErrorMapping(async () => {
      const data = await clients.graphql<{ viewer: ViewerProfile }>(VIEWER_PROFILE_QUERY);
      return data.viewer;
    });
}

export function makeViewerContributionsFetcher(clients: GitHubClients) {
  return ({ from, to }: ViewerContributionsArgs) =>
    callWithErrorMapping(async () => {
      const data = await clients.graphql<ViewerContributions>(VIEWER_CONTRIBUTIONS_QUERY, {
        from: toIso(from),
        to: toIso(to),
      });
      return data.viewer.contributionsCollection;
    });
}

export function makeViewerOrgsFetcher(clients: GitHubClients) {
  return () =>
    callWithErrorMapping(async () => {
      const data = await clients.graphql<ViewerOrgs>(VIEWER_ORGS_QUERY);
      return data.viewer.organizations.nodes;
    });
}

export type CommitHistoryPage = {
  commits: NonNullable<
    NonNullable<NonNullable<RepoCommitHistory['repository']>['defaultBranchRef']>['target']
  >['history']['nodes'];
  totalCount: number;
  pageInfo: { endCursor: string | null; hasNextPage: boolean };
};

export function makeRepoCommitHistoryFetcher(clients: GitHubClients) {
  return ({
    owner,
    name,
    since,
    until,
    after,
    first = COMMIT_PAGE_SIZE,
  }: RepoCommitHistoryArgs): Promise<CommitHistoryPage> =>
    callWithErrorMapping(async () => {
      const data = await clients.graphql<RepoCommitHistory>(REPO_COMMIT_HISTORY_QUERY, {
        owner,
        name,
        since: since ? toIso(since) : null,
        until: until ? toIso(until) : null,
        after: after ?? null,
        first: Math.min(first, COMMIT_PAGE_SIZE),
      });
      const history = data.repository?.defaultBranchRef?.target?.history;
      if (!history) {
        return {
          commits: [],
          totalCount: 0,
          pageInfo: { endCursor: null, hasNextPage: false },
        };
      }
      return {
        commits: history.nodes,
        totalCount: history.totalCount,
        pageInfo: history.pageInfo,
      };
    });
}

export function makeViewerRepoLanguagesFetcher(clients: GitHubClients) {
  return () =>
    callWithErrorMapping(async () => {
      const data = await clients.graphql<ViewerRepoLanguages>(VIEWER_REPO_LANGUAGES_QUERY);
      const seen = new Set<string>();
      const repos = [...data.viewer.repositories.nodes, ...data.viewer.repositoriesContributedTo.nodes].filter(
        (r) => {
          if (seen.has(r.nameWithOwner)) return false;
          seen.add(r.nameWithOwner);
          return true;
        },
      );
      return repos;
    });
}

export function makeRepoLanguagesFetcher(clients: GitHubClients) {
  return ({ owner, name }: { owner: string; name: string }) =>
    callWithErrorMapping(async () => {
      const data = await clients.graphql<RepoLanguages>(REPO_LANGUAGES_QUERY, {
        owner,
        name,
      });
      return data.repository?.languages ?? { totalSize: 0, edges: [] };
    });
}

export function makeUserRestFetcher(clients: GitHubClients) {
  return async () => {
    try {
      const { data } = await clients.rest.users.getAuthenticated();
      return data;
    } catch (err) {
      throw toGitHubApiError(err);
    }
  };
}

export function makeRepoCommitFetcher(clients: GitHubClients) {
  return async ({ owner, repo, ref }: { owner: string; repo: string; ref: string }) => {
    try {
      const response = await clients.rest.repos.getCommit({ owner, repo, ref });
      const headers = response.headers as Record<string, string | undefined>;
      const rateLimit = detectRateLimit(response.status, headers, undefined);
      if (rateLimit) emitRateLimit(rateLimit);
      return response.data;
    } catch (err) {
      throw toGitHubApiError(err);
    }
  };
}

// Re-export for hooks / workers that import from `api/github`.
export type { CommitsByDay } from './commitsByDayRange';

// "Pure" commits per day — month-chunk cache + serialized search (spec §3.D.1).
// Uses REST search/commits with `merge:false`. Chunking + queue live in
// `commitsByDayRange.ts` / `githubCommitsSearch.ts`.

export type CommitsByDayArgs = {
  login: string;
  from: Date | string;
  to: Date | string;
};

export function makeViewerCommitsByDayFetcher(clients: GitHubClients) {
  return async ({ login, from, to }: CommitsByDayArgs): Promise<CommitsByDay> =>
    ensureCommitsByDayRange(clients, login, from, to, { priority: 'foreground' });
}
