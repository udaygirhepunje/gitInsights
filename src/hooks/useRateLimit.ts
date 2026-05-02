import { useEffect, useState } from 'react';

import type { GitHubErrorKind } from '../api/errors';
import { getLastRateLimit, subscribeRateLimit } from '../api/events';

type RateLimitInfo = Extract<GitHubErrorKind, { kind: 'rate-limit' }>;

function displayUntilMs(info: RateLimitInfo): number | null {
  const times = [info.resetAt, info.retryAfterAt]
    .filter((d): d is Date => d != null && !Number.isNaN(d.getTime()))
    .map((d) => d.getTime());
  if (times.length === 0) return null;
  return Math.max(...times);
}

function isActive(info: RateLimitInfo | null): boolean {
  if (!info) return false;
  if (info.remaining === null && info.resetAt === null && info.retryAfterAt === null) {
    return false;
  }
  const until = displayUntilMs(info);
  if (until != null && until > Date.now()) return true;
  if (until != null && until <= Date.now()) return false;
  return info.remaining === 0;
}

function isClearedEvent(info: RateLimitInfo): boolean {
  return info.resetAt === null && info.remaining === null && info.retryAfterAt === null;
}

export function useRateLimit(): RateLimitInfo | null {
  const [info, setInfo] = useState<RateLimitInfo | null>(() => getLastRateLimit());

  useEffect(() => {
    return subscribeRateLimit((next) => {
      setInfo(isClearedEvent(next) ? null : next);
    });
  }, []);

  useEffect(() => {
    const until = info ? displayUntilMs(info) : null;
    if (until == null) return;
    const ms = until - Date.now();
    if (ms <= 0) {
      setInfo(null);
      return;
    }
    const handle = window.setTimeout(() => setInfo(null), ms + 1000);
    return () => window.clearTimeout(handle);
  }, [info]);

  return isActive(info) ? info : null;
}
