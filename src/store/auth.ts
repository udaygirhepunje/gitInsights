import { create } from 'zustand';

import { clearAllQueryCache } from '../api/queryClient';
import { fetchViewer, GitHubAuthError, type Viewer } from '../lib/github';
import { clearAppIndexedDb, clearLocalStorageNamespace } from '../lib/storage';

// Auth lifecycle: token in localStorage under `gi.auth.token`, boot
// validation against `viewer { login }`, login redirect, logout that wipes
// the world. Spec §3.A + §3.H. The token persists as a bare string (not via
// Zustand's persist middleware) so other modules can read it directly
// without depending on a JSON envelope shape.

export const AUTH_TOKEN_STORAGE_KEY = 'gi.auth.token';

export const DEFAULT_SCOPES = ['read:user', 'user:email', 'repo', 'read:org'] as const;
// Incremental scopes (spec §3.A). Requested only when the user opts into the
// feature that needs them. Re-auth runs through the same /callback path; the
// new token replaces the old one in localStorage.
export const SYNC_SCOPE = 'gist' as const;
const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';

// Discriminated union so callers can switch on `status` without juggling
// "is the token nullish AND viewer non-null?" combinations.
//
// - `idle`            — no token, nothing in flight (logged out).
// - `validating`      — boot check or post-callback exchange in flight.
// - `authenticated`   — token validated, viewer loaded.
// - `error`           — last validation attempt failed (non-401 problem;
//                       401 transitions us straight back to `idle`).
export type AuthStatus = 'idle' | 'validating' | 'authenticated' | 'error';

type AuthState = {
  token: string | null;
  viewer: Viewer | null;
  status: AuthStatus;
  error: string | null;
  bootstrap: () => Promise<void>;
  setSession: (token: string) => Promise<Viewer>;
  login: () => void;
  reauthorize: (extraScopes: readonly string[]) => void;
  logout: () => Promise<void>;
};

function readToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

function writeToken(token: string): void {
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

function dropToken(): void {
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

export function buildAuthorizeUrl(extraScopes: readonly string[] = []): string {
  const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
  const redirectUri = import.meta.env.VITE_OAUTH_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    throw new Error(
      'OAuth env not configured: set VITE_GITHUB_CLIENT_ID and VITE_OAUTH_REDIRECT_URI in .env.local',
    );
  }
  const scopes = [...new Set<string>([...DEFAULT_SCOPES, ...extraScopes])];
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
    // We don't yet implement state validation across the redirect (it would
    // require persisting a nonce in sessionStorage). Tracked as a follow-up
    // alongside the GitHub App migration noted in spec §3.A "Token Lifecycle".
  });
  return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // If a token exists, start in `validating` so route guards don’t treat the
  // first paint as logged-out (RequireAuth would bounce to `/`, then Landing
  // would redirect authed users to `/dashboard` — losing deep links like `/settings`).
  const initialToken = readToken();
  return {
    token: initialToken,
    viewer: null,
    status: initialToken ? 'validating' : 'idle',
    error: null,

    // Called once from <App /> on mount. If a token is sitting in localStorage
    // from a prior session, validate it cheaply; on 401 we clear and route the
    // user back to `/` (the App-level effect handles the redirect — keeps this
    // store router-agnostic and easy to test).
    bootstrap: async () => {
      const token = readToken();
      if (!token) {
        set({ token: null, viewer: null, status: 'idle', error: null });
        return;
      }
      set({ token, status: 'validating', error: null });
      try {
        const viewer = await fetchViewer(token);
        set({ viewer, status: 'authenticated' });
      } catch (err) {
        if (err instanceof GitHubAuthError) {
          // Spec §3.H: 401 / token invalid → silent clear, App-level effect
          // routes back to `/`.
          dropToken();
          set({ token: null, viewer: null, status: 'idle', error: null });
          return;
        }
        // Network blip or 5xx — keep the token (the user might just be offline)
        // but mark the boot as errored so the UI can decide whether to retry.
        set({ status: 'error', error: 'viewer_fetch_failed' });
      }
    },

    // Called by /callback after the proxy returns an access token. Persists,
    // validates, and resolves with the viewer so the callback can wait for a
    // confirmed session before navigating to /dashboard.
    setSession: async (token: string) => {
      writeToken(token);
      set({ token, status: 'validating', error: null });
      try {
        const viewer = await fetchViewer(token);
        set({ viewer, status: 'authenticated' });
        return viewer;
      } catch (err) {
        dropToken();
        set({ token: null, viewer: null, status: 'idle', error: null });
        throw err;
      }
    },

    login: () => {
      window.location.assign(buildAuthorizeUrl());
    },

    // Re-authorization for opt-in scope upgrades (spec §3.A incremental scopes,
    // §3.G sync). Same /callback path; the proxy returns a fresh token that
    // replaces the old one. Caller is responsible for marking intent in
    // localStorage *before* calling so /callback can act on it post-redirect.
    reauthorize: (extraScopes) => {
      window.location.assign(buildAuthorizeUrl(extraScopes));
    },

    logout: async () => {
      // Order matters: clear storage BEFORE in-memory state so any other
      // store/effect that reads from localStorage during the same tick sees
      // the wiped values.
      clearLocalStorageNamespace();
      await clearAllQueryCache();
      await clearAppIndexedDb();
      set({ token: null, viewer: null, status: 'idle', error: null });
      void get;
    },
  };
});
