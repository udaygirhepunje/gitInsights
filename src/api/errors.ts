import { RequestError } from '@octokit/request-error';
import { GraphqlResponseError } from '@octokit/graphql';

// Spec §3.H: these are the only error shapes the data layer surfaces. Tile UI
// (Phase 4) discriminates on `kind` to pick the right empty/error state; the
// global rate-limit banner subscribes via the event emitter in `events.ts`.

export type GitHubErrorKind =
  | { kind: 'rate-limit'; resetAt: Date | null; remaining: number | null; retryAfterAt: Date | null }
  | { kind: 'sso-required'; ssoUrl: string | null }
  | { kind: 'unauthorized' }
  | { kind: 'not-found' }
  | { kind: 'network' }
  | { kind: 'server'; status: number }
  | { kind: 'unknown'; status: number | null; message: string };

export class GitHubApiError extends Error {
  readonly info: GitHubErrorKind;

  constructor(info: GitHubErrorKind, message?: string) {
    super(message ?? `github_${info.kind}`);
    this.name = 'GitHubApiError';
    this.info = info;
  }
}

type HeaderBag = Record<string, string | undefined> | undefined;

function readHeader(headers: HeaderBag, name: string): string | undefined {
  if (!headers) return undefined;
  const direct = headers[name];
  if (direct !== undefined) return direct;
  const lowered = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lowered) return headers[key];
  }
  return undefined;
}

function parseRetryAfterSeconds(headers: HeaderBag): number | null {
  const raw = readHeader(headers, 'retry-after');
  if (raw === undefined) return null;
  const asInt = Number(raw);
  if (Number.isFinite(asInt) && asInt >= 0) return Math.min(asInt, 86_400);
  const asDate = Date.parse(raw);
  if (Number.isFinite(asDate)) {
    const sec = Math.ceil((asDate - Date.now()) / 1000);
    return sec > 0 ? Math.min(sec, 86_400) : null;
  }
  return null;
}

export function detectRateLimit(
  status: number,
  headers: HeaderBag,
  bodyMessage: string | undefined,
): Extract<GitHubErrorKind, { kind: 'rate-limit' }> | null {
  if (status !== 403 && status !== 429) return null;

  const remainingRaw = readHeader(headers, 'x-ratelimit-remaining');
  const remaining = remainingRaw != null ? Number(remainingRaw) : null;
  const resetRaw = readHeader(headers, 'x-ratelimit-reset');
  const resetSeconds = resetRaw != null ? Number(resetRaw) : NaN;
  const resetFromHeader = Number.isFinite(resetSeconds) ? new Date(resetSeconds * 1000) : null;

  const retrySec = parseRetryAfterSeconds(headers);
  const retryAfterAt = retrySec != null && retrySec > 0 ? new Date(Date.now() + retrySec * 1000) : null;

  const resetAt = resetFromHeader;

  const message = (bodyMessage ?? '').toLowerCase();
  const looksLikeRateLimit =
    remaining === 0 ||
    message.includes('rate limit') ||
    message.includes('api rate limit') ||
    message.includes('secondary rate limit') ||
    message.includes('abuse detection');

  if (!looksLikeRateLimit) return null;

  return {
    kind: 'rate-limit',
    resetAt,
    remaining: Number.isFinite(remaining as number) ? (remaining as number) : null,
    retryAfterAt,
  };
}

// Parses GitHub's `x-github-sso` header. Format examples:
//   `required; url=https://github.com/orgs/<org>/sso?...`
//   `partial-results; url=...` (some endpoints return partial data alongside)
export function parseSsoHeader(value: string | undefined): { ssoUrl: string | null } | null {
  if (!value) return null;
  if (!value.toLowerCase().includes('required') && !value.toLowerCase().includes('partial')) {
    return null;
  }
  const match = /url\s*=\s*"?([^";\s]+)"?/i.exec(value);
  return { ssoUrl: match?.[1] ?? null };
}

export function detectSsoRequired(
  status: number,
  headers: HeaderBag,
): Extract<GitHubErrorKind, { kind: 'sso-required' }> | null {
  if (status !== 403) return null;
  const sso = parseSsoHeader(readHeader(headers, 'x-github-sso'));
  if (!sso) return null;
  return { kind: 'sso-required', ssoUrl: sso.ssoUrl };
}

function classifyHttpError(
  status: number,
  headers: HeaderBag,
  bodyMessage: string | undefined,
): GitHubErrorKind {
  if (status === 401) return { kind: 'unauthorized' };

  const sso = detectSsoRequired(status, headers);
  if (sso) return sso;

  const rate = detectRateLimit(status, headers, bodyMessage);
  if (rate) return rate;

  if (status === 404) return { kind: 'not-found' };
  if (status >= 500) return { kind: 'server', status };
  return { kind: 'unknown', status, message: bodyMessage ?? `http_${status}` };
}

type GraphqlErrorEntry = { type?: string; message?: string };

function classifyGraphqlErrors(errors: GraphqlErrorEntry[]): GitHubErrorKind | null {
  for (const err of errors) {
    if (err.type === 'RATE_LIMITED') {
      return { kind: 'rate-limit', resetAt: null, remaining: 0, retryAfterAt: null };
    }
    if (err.type === 'FORBIDDEN' || err.type === 'UNAUTHENTICATED') {
      return { kind: 'unauthorized' };
    }
    if (err.type === 'NOT_FOUND') {
      return { kind: 'not-found' };
    }
  }
  return null;
}

export function classifyError(error: unknown): GitHubErrorKind {
  if (error instanceof GitHubApiError) return error.info;

  if (error instanceof GraphqlResponseError) {
    const fromGraphql = classifyGraphqlErrors(error.errors as GraphqlErrorEntry[]);
    if (fromGraphql) return fromGraphql;
    return {
      kind: 'unknown',
      status: null,
      message: error.message,
    };
  }

  if (error instanceof RequestError) {
    return classifyHttpError(
      error.status,
      error.response?.headers as HeaderBag,
      (error.response?.data as { message?: string } | undefined)?.message ?? error.message,
    );
  }

  if (error instanceof TypeError) {
    return { kind: 'network' };
  }

  if (error instanceof Error) {
    return { kind: 'unknown', status: null, message: error.message };
  }

  return { kind: 'unknown', status: null, message: 'unknown_error' };
}

export function toGitHubApiError(error: unknown): GitHubApiError {
  if (error instanceof GitHubApiError) return error;
  return new GitHubApiError(classifyError(error));
}

export function isRetryable(info: GitHubErrorKind): boolean {
  if (info.kind === 'network') return true;
  if (info.kind === 'server') return true;
  return false;
}
