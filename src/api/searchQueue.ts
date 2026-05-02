// Serializes GET /search/commits to reduce secondary rate limits (spec §3.D.1).
import { emitRateLimit } from './events';
import type { GitHubErrorKind } from './errors';
import { classifyError } from './errors';

const COOLDOWN_KEY = 'gi.search.cooldown';
const MIN_GAP_MS = 2000;

type Priority = 'foreground' | 'backfill';

type TaskEntry = {
  priority: Priority;
  run: () => Promise<unknown>;
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
};

let foregroundQueue: TaskEntry[] = [];
let backfillQueue: TaskEntry[] = [];
/** Promise chain tail — only one task executes at a time. */
let chain: Promise<void> = Promise.resolve();
let lastFinishMs = 0;

function readCooldownUntil(): number {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem(COOLDOWN_KEY);
  if (!raw) return 0;
  const t = Number(raw);
  return Number.isFinite(t) ? t : 0;
}

function writeCooldownUntil(ts: number): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(COOLDOWN_KEY, String(ts));
}

function clearCooldown(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(COOLDOWN_KEY);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForCooldown(): Promise<void> {
  const until = readCooldownUntil();
  const wait = until - Date.now();
  if (wait > 0) await sleep(wait);
  clearCooldown();
}

function dequeue(): TaskEntry | undefined {
  const fg = foregroundQueue.shift();
  if (fg) return fg;
  return backfillQueue.shift();
}

/**
 * Pause all search/commits calls until `seconds` from now (or until cooldown
 * already stored is later). Persists to `localStorage` and surfaces the banner.
 */
export function pauseSearchCommits(
  seconds: number,
  rateInfo?: Extract<GitHubErrorKind, { kind: 'rate-limit' }>,
): void {
  const until = Date.now() + Math.max(1, seconds) * 1000;
  const existing = readCooldownUntil();
  const finalUntil = Math.max(until, existing);
  writeCooldownUntil(finalUntil);
  const resetAt = new Date(finalUntil);
  if (rateInfo) {
    emitRateLimit({ ...rateInfo, resetAt });
  } else {
    emitRateLimit({ kind: 'rate-limit', resetAt, remaining: null, retryAfterAt: null });
  }
}

export function getSearchCooldownUntilMs(): number {
  return readCooldownUntil();
}

/** Call when user should no longer see search throttle banner for cooldown-only paths. */
export function resumeIfCooldownExpired(): void {
  const until = readCooldownUntil();
  if (until <= Date.now()) clearCooldown();
}

export function enqueueSearchCommits<T>(priority: Priority, run: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const entry: TaskEntry = {
      priority,
      run: () => run(),
      resolve: (v) => resolve(v as T),
      reject,
    };
    if (priority === 'foreground') foregroundQueue.push(entry);
    else backfillQueue.push(entry);

    chain = chain.then(async () => {
      const task = dequeue();
      if (!task) return;

      await waitForCooldown();

      const sinceLast = Date.now() - lastFinishMs;
      if (lastFinishMs > 0 && sinceLast < MIN_GAP_MS) await sleep(MIN_GAP_MS - sinceLast);

      try {
        const result = await task.run();
        task.resolve(result);
      } catch (e) {
        task.reject(e);
      } finally {
        lastFinishMs = Date.now();
      }
    });
  });
}

export function searchRateLimitPauseSeconds(err: unknown): number | null {
  const info = classifyError(err);
  if (info.kind !== 'rate-limit') return null;
  if (info.retryAfterAt)
    return Math.max(1, Math.ceil((info.retryAfterAt.getTime() - Date.now()) / 1000));
  return 60;
}

/** Apply cooldown + banner after a thrown search/commits error. */
export function pauseAfterSearchFailure(err: unknown): boolean {
  const sec = searchRateLimitPauseSeconds(err);
  if (sec == null) return false;
  const info = classifyError(err);
  if (info.kind !== 'rate-limit') return false;
  pauseSearchCommits(sec, info);
  return true;
}
