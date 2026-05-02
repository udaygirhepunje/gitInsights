import { describe, expect, it } from 'vitest';

import {
  classifyError,
  detectRateLimit,
  detectSsoRequired,
  isRetryable,
  parseSsoHeader,
} from '../errors';

describe('detectRateLimit', () => {
  it('returns null for non-rate-limit statuses', () => {
    expect(detectRateLimit(200, {}, 'ok')).toBeNull();
    expect(detectRateLimit(404, {}, 'not found')).toBeNull();
  });

  it('flags 403 with x-ratelimit-remaining=0', () => {
    const result = detectRateLimit(
      403,
      { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1700000000' },
      'API rate limit exceeded',
    );
    expect(result?.kind).toBe('rate-limit');
    expect(result?.remaining).toBe(0);
    expect(result?.resetAt).toEqual(new Date(1_700_000_000_000));
  });

  it('reads headers case-insensitively', () => {
    const result = detectRateLimit(
      403,
      { 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': '1700000000' },
      'rate limit',
    );
    expect(result?.remaining).toBe(0);
  });

  it('flags 429 (secondary rate limit)', () => {
    const result = detectRateLimit(429, {}, 'You have triggered an abuse detection mechanism');
    expect(result?.kind).toBe('rate-limit');
  });

  it('flags 403 with rate-limit body even when headers are missing', () => {
    const result = detectRateLimit(403, {}, 'API rate limit exceeded for user');
    expect(result?.kind).toBe('rate-limit');
    expect(result?.resetAt).toBeNull();
  });

  it('parses Retry-After as seconds on 403 rate-limit', () => {
    const result = detectRateLimit(
      403,
      { 'retry-after': '120' },
      'You have exceeded a secondary rate limit',
    );
    expect(result?.kind).toBe('rate-limit');
    expect(result?.retryAfterAt).not.toBeNull();
    if (result?.retryAfterAt) {
      const delta = result.retryAfterAt.getTime() - Date.now();
      expect(delta).toBeGreaterThan(119_000);
      expect(delta).toBeLessThan(121_000);
    }
  });
});

describe('parseSsoHeader / detectSsoRequired', () => {
  it('parses required + url', () => {
    expect(
      parseSsoHeader('required; url=https://github.com/orgs/acme/sso?return_to=foo'),
    ).toEqual({ ssoUrl: 'https://github.com/orgs/acme/sso?return_to=foo' });
  });

  it('parses partial-results header', () => {
    expect(parseSsoHeader('partial-results; url=https://github.com/orgs/acme/sso')).toEqual({
      ssoUrl: 'https://github.com/orgs/acme/sso',
    });
  });

  it('returns null when header is absent or unrelated', () => {
    expect(parseSsoHeader(undefined)).toBeNull();
    expect(parseSsoHeader('something-else')).toBeNull();
  });

  it('handles quoted url values', () => {
    expect(parseSsoHeader('required; url="https://github.com/orgs/acme/sso"')).toEqual({
      ssoUrl: 'https://github.com/orgs/acme/sso',
    });
  });

  it('detectSsoRequired only fires on 403', () => {
    expect(
      detectSsoRequired(401, {
        'x-github-sso': 'required; url=https://github.com/orgs/acme/sso',
      }),
    ).toBeNull();
    expect(
      detectSsoRequired(403, {
        'x-github-sso': 'required; url=https://github.com/orgs/acme/sso',
      }),
    ).toEqual({ kind: 'sso-required', ssoUrl: 'https://github.com/orgs/acme/sso' });
  });
});

describe('classifyError', () => {
  it('passes through GitHubApiError info', () => {
    const err = new Error('boom') as Error;
    const info = classifyError(err);
    expect(info.kind).toBe('unknown');
  });

  it('treats TypeError as a network failure', () => {
    expect(classifyError(new TypeError('Failed to fetch')).kind).toBe('network');
  });
});

describe('isRetryable', () => {
  it('retries network and 5xx', () => {
    expect(isRetryable({ kind: 'network' })).toBe(true);
    expect(isRetryable({ kind: 'server', status: 503 })).toBe(true);
  });

  it('does not retry rate limit, sso, unauthorized, not-found', () => {
    expect(isRetryable({ kind: 'rate-limit', resetAt: null, remaining: 0, retryAfterAt: null })).toBe(
      false,
    );
    expect(isRetryable({ kind: 'sso-required', ssoUrl: null })).toBe(false);
    expect(isRetryable({ kind: 'unauthorized' })).toBe(false);
    expect(isRetryable({ kind: 'not-found' })).toBe(false);
  });
});
