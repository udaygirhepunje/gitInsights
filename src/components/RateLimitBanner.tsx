import { Alert } from '@mantine/core';

import { useRateLimit } from '../hooks/useRateLimit';

function formatResetTime(resetAt: Date | null): string {
  if (!resetAt) return 'soon';
  return resetAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function RateLimitBanner(): JSX.Element | null {
  const info = useRateLimit();
  if (!info) return null;

  return (
    <Alert
      color="primerYellow"
      variant="light"
      title="github rate-limited us"
      role="status"
      aria-live="polite"
    >
      resets at {formatResetTime(info.resetAt)}. what already loaded below stays until then.
    </Alert>
  );
}
