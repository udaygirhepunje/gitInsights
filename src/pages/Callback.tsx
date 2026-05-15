import { Alert, Button, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useAuthStore } from '../store/auth';
import { consumeSyncIntent, enableAfterReauth } from '../sync';

// /callback handler. Lifecycle (spec §3.A, §4.B, Phase 2 task list):
//
// 1. Read `?code=` from the URL. GitHub also sends `error` / `error_description`
//    when the user denies the consent screen — surface those before doing anything.
// 2. POST `{ code }` to VITE_PROXY_URL.
// 3. On success, hand the token to the auth store (which persists + validates
//    against `viewer { login }`), then navigate('/dashboard', { replace: true }).
// 4. On failure, show an inline error tile with a "try again" button that
//    routes back to `/`.
//
// We strip the `code` from history with `replaceState` immediately on mount so
// it never lingers in the URL bar (per spec §6 "no PII / no codes in logs"
// — even though the SPA itself doesn't log them, the browser history does).

type CallbackState =
  | { kind: 'pending' }
  | { kind: 'error'; reason: string };

const PROXY_ERROR_COPY: Record<string, string> = {
  missing_code: "github didn't send a code back. start over from the login screen.",
  bad_verification_code:
    'github says that code is no good (probably reused or expired). try logging in again.',
  rate_limited: 'too many login attempts in a row. wait a minute and try again.',
  origin_not_allowed:
    'this browser origin is not on the proxy CORS allowlist. self-hosters: set ALLOWED_ORIGIN on vercel to match this domain exactly.',
  proxy_misconfigured:
    'the token proxy is missing GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, or ALLOWED_ORIGIN. self-hosters: configure those in the vercel dashboard and redeploy.',
  upstream_unreachable:
    "couldn't reach github from the token proxy. probably transient — try again.",
  upstream_invalid_json: 'github responded with something that wasn’t json. try again.',
};

const SYNC_INTENT_KEY = 'gi.sync.pending-enable';

export function CallbackPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [state, setState] = useState<CallbackState>({ kind: 'pending' });
  // StrictMode mounts effects twice in dev; guard so we don't double-POST the
  // single-use OAuth code (the second exchange would always fail with
  // `bad_verification_code`).
  const exchangeStartedRef = useRef(false);
  // Snapshot the sync-intent flag synchronously on first mount, before
  // SyncBoot or any async work can consume/remove it.
  const syncIntentRef = useRef(
    typeof window !== 'undefined' ? window.localStorage.getItem(SYNC_INTENT_KEY) : null,
  );

  const code = searchParams.get('code');
  const oauthError = searchParams.get('error');
  const oauthErrorDescription = searchParams.get('error_description');

  const reset = useCallback(() => {
    navigate('/', { replace: true });
  }, [navigate]);

  useEffect(() => {
    // Strip ?code from the URL bar regardless of outcome — same effect
    // as React Router's `replace: true` but synchronous.
    if (typeof window !== 'undefined' && window.location.search) {
      const cleaned = `${window.location.pathname}${window.location.hash}`;
      window.history.replaceState(window.history.state, '', cleaned);
    }
  }, []);

  useEffect(() => {
    if (exchangeStartedRef.current) return;

    // GitHub denied / cancelled — bail before talking to the proxy.
    if (oauthError) {
      exchangeStartedRef.current = true;
      setState({
        kind: 'error',
        reason: oauthErrorDescription || oauthError,
      });
      return;
    }

    if (!code) {
      exchangeStartedRef.current = true;
      setState({ kind: 'error', reason: 'missing_code' });
      return;
    }

    const proxyUrl = import.meta.env.VITE_PROXY_URL;
    if (!proxyUrl) {
      exchangeStartedRef.current = true;
      setState({ kind: 'error', reason: 'proxy_misconfigured' });
      return;
    }

    exchangeStartedRef.current = true;

    // No `cancelled` flag here on purpose. `exchangeStartedRef` already
    // guarantees a single POST under StrictMode's mount→cleanup→mount cycle;
    // adding a cleanup-driven cancel would race the in-flight exchange and
    // silently drop the setState on dev rerenders, leaving the UI stuck on
    // the loader. React 18 no longer warns about setState after unmount.
    void (async () => {
      try {
        const response = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ code }),
        });

        const payload = (await response.json().catch(() => ({}))) as {
          access_token?: string;
          error?: string;
          error_description?: string;
        };

        if (!response.ok || !payload.access_token) {
          setState({
            kind: 'error',
            reason: payload.error || `proxy_${response.status}`,
          });
          return;
        }

        await setSession(payload.access_token);

        if (syncIntentRef.current) {
          // The user came here via the sync opt-in re-auth flow. The new
          // token (with gist scope) is now active, so we consume the intent
          // and enable sync ourselves — SyncBoot can't reliably do it
          // because its effect dependencies (authStatus / viewerLogin) may
          // not change when the same user re-authenticates with a new token.
          consumeSyncIntent();
          void enableAfterReauth();
          navigate('/settings', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      } catch {
        setState({ kind: 'error', reason: 'network_error' });
      }
    })();
  }, [code, oauthError, oauthErrorDescription, navigate, setSession]);

  if (state.kind === 'error') {
    const friendly =
      PROXY_ERROR_COPY[state.reason] ??
      `something broke during token exchange (${state.reason}). try again.`;
    return (
      <Stack gap="md" maw={520}>
        <Title order={1}>login didn&apos;t finish</Title>
        <Alert color="primerRed" variant="light" title="token exchange failed">
          {friendly}
        </Alert>
        <Group>
          <Button color="primerBlue" onClick={reset}>
            try again
          </Button>
        </Group>
      </Stack>
    );
  }

  return (
    <Stack gap="md" maw={520} role="status" aria-live="polite">
      <Title order={1}>signing you in…</Title>
      <Group gap="xs">
        <Loader size="sm" type="dots" />
        <Text c="dimmed">trading the github code for a token. shouldn&apos;t take long.</Text>
      </Group>
    </Stack>
  );
}
