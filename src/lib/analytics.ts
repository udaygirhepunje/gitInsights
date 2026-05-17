// Thin wrapper around the Umami global. In local dev the script tag is stripped
// from index.html so `umami` is never defined — every call here is a safe no-op.
//
// The Umami script loads with `defer`, so it may not be ready when auth
// `bootstrap()` fires on page load. `identifyUser` retries a few times to
// handle this race. `trackEvent` does the same so early events aren't lost.

const POLL_INTERVAL_MS = 200;
const MAX_POLLS = 25; // ~5 seconds total

function getUmami(): UmamiTracker | undefined {
  return typeof umami !== 'undefined' ? umami : undefined;
}

function whenReady(fn: (u: UmamiTracker) => void): void {
  const u = getUmami();
  if (u) { fn(u); return; }

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    const ready = getUmami();
    if (ready) { clearInterval(timer); fn(ready); }
    else if (attempts >= MAX_POLLS) { clearInterval(timer); }
  }, POLL_INTERVAL_MS);
}

export function trackEvent(event: string, data?: Record<string, string | number>): void {
  whenReady((u) => u.track(event, data));
}

export function identifyUser(login: string): void {
  whenReady((u) => u.identify({ id: login }));
}
