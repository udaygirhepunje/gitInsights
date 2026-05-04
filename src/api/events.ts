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

type SsoRequiredInfo = Extract<GitHubErrorKind, { kind: 'sso-required' }>;
type SsoListener = (info: SsoRequiredInfo | null) => void;

const ssoListeners = new Set<SsoListener>();
let lastSsoEvent: SsoRequiredInfo | null = null;

/** Rate-limit + org SAML SSO banners (see `toGitHubApiError` in `errors.ts`). */
export function emitGlobalGitHubSignals(info: GitHubErrorKind): void {
  if (info.kind === 'rate-limit') emitRateLimit(info);
  if (info.kind === 'sso-required') emitSsoRequired(info);
}

export function emitSsoRequired(info: SsoRequiredInfo): void {
  lastSsoEvent = info;
  for (const listener of ssoListeners) listener(info);
}

export function clearSsoRequired(): void {
  lastSsoEvent = null;
  for (const listener of ssoListeners) listener(null);
}

export function subscribeSsoRequired(listener: SsoListener): () => void {
  ssoListeners.add(listener);
  return () => {
    ssoListeners.delete(listener);
  };
}

export function getLastSsoRequired(): SsoRequiredInfo | null {
  return lastSsoEvent;
}
