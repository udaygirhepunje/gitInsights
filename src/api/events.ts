import type { GitHubErrorKind } from './errors';

type RateLimitInfo = Extract<GitHubErrorKind, { kind: 'rate-limit' }>;
type Listener = (info: RateLimitInfo) => void;

const listeners = new Set<Listener>();
let lastEvent: RateLimitInfo | null = null;

export function emitRateLimit(info: RateLimitInfo): void {
  lastEvent = info;
  for (const listener of listeners) listener(info);
}

export function clearRateLimit(): void {
  lastEvent = null;
  for (const listener of listeners) {
    listener({ kind: 'rate-limit', resetAt: null, remaining: null, retryAfterAt: null });
  }
}

export function subscribeRateLimit(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLastRateLimit(): RateLimitInfo | null {
  return lastEvent;
}
