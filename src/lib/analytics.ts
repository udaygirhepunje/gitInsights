// Thin wrapper around the Umami global. In local dev the script tag is stripped
// from index.html so `umami` is never defined — every call here is a safe no-op.
//
// The Umami script loads with `defer`, so it may not be ready when auth
// `bootstrap()` fires on page load. `identifyUser` retries a few times to
// handle this race. `trackEvent` does the same so early events aren't lost.
//
// Every event includes the distinct `id` in its payload so the Umami dashboard
// can attribute page views and custom events to the identified user.

const POLL_INTERVAL_MS = 200;
const MAX_POLLS = 25; // ~5 seconds total

let currentUserId: string | null = null;

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
  whenReady((u) => u.track((props) => ({
    ...props,
    name: event,
    ...(currentUserId ? { id: currentUserId } : {}),
    ...(data ? { data } : {}),
  })));
}

export function identifyUser(login: string): void {
  currentUserId = login;
  whenReady((u) => u.identify(login));
}
