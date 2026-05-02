# Phase 11 — Incremental Commit Cache & Progressive Backfill

**Goal**: eliminate secondary rate-limit `403`s on first/cold page loads by replacing the "fetch entire 12-month window every time" pattern with month-chunked local storage, progressive background backfill, and a global search-request throttle.

**Spec refs**: `spec.md §3.D Rate Limiting & Caching`, `spec.md §3.D.1 Incremental Commit Cache`, `spec.md §3.H Error Handling`, `spec.md §7 GitHub API Surface` (`GET /search/commits`).

**Depends on**: Phase 3 (GitHub data layer, TanStack Query, IndexedDB persistence), Phase 9 (global timeframe filter), Phase 10 (cross-tile highlights — no regressions).

**Screens touched**: `/dashboard` (all tiles consuming `useViewerCommitsByDay`), `/settings` (new "Refresh all commit data" action in Data controls).

---

## Acceptance criteria

### Month-chunk commit store
- [x] Commit data for `search/commits` is stored in IndexedDB as independent calendar-month chunks, keyed by `gi.commits.<login>.<YYYY-MM>`.
- [x] Each chunk stores `{ byDate: Record<string, number>, timestamps: string[], fetchedAt: string, sealed: boolean }`.
- [x] A chunk is marked `sealed: true` once its month is more than 30 days in the past. Sealed chunks are never re-fetched automatically.
- [x] The current-month chunk (and optionally the previous month) is the only one re-fetched on repeat visits, respecting the existing 1-hour `staleTime`.

### Assembled query response
- [x] `useViewerCommitsByDay` continues to return the same `CommitsByDay` shape (`byDate`, `timestamps`, `totalCommits`, `fromIso`, `toIso`, `truncated`).
- [x] The hook assembles its response by merging the month-chunks that overlap the requested `{from, to}` range.
- [x] If any chunk in the range is missing, only that chunk is fetched — not the entire range.
- [x] Partial data (some chunks loaded, others pending) is surfaced immediately so tiles can render progressively.

### Progressive backfill
- [x] On first-ever login the default timeframe is `last-30-days`. The app fetches only the current month, renders the dashboard, and begins background backfill.
- [x] Backfill walks backwards month-by-month towards 12 months ago with a **15-second delay** between each chunk fetch.
- [x] Backfill is interruptible: if the user closes the tab, completed chunks persist and the next visit resumes from the first missing chunk.
- [x] Backfill progress is visible: the Consistency Map fills in progressively (right-to-left), and a subtle text indicator appears on tiles still waiting for data (e.g., "loading older data…").
- [x] The Streak tile and ConsistencyTile, which always need the trailing 53 weeks, show partial data during backfill and update live as chunks arrive.

### Search request throttle
- [x] A global request queue for `search/commits` allows at most **1 in-flight search request** at a time with a minimum **2-second gap** between consecutive requests.
- [x] On `403`/`429`: read `Retry-After` header if present; otherwise pause the queue for **60 seconds**. Persist the cooldown expiry in `localStorage` (`gi.search.cooldown`) so all tabs and reloads respect it.
- [x] The queue applies to both foreground fetches (user-triggered) and background backfill.
- [x] The existing `RateLimitBanner` continues to work; it shows the cooldown timer when the search queue is paused.

### Returning-user fast path
- [x] Sealed month-chunks load from IndexedDB on boot — zero API calls, instant render.
- [x] Only the gap between the latest cached date and today is fetched (typically 0–few days, 1 API call).
- [x] Switching timeframes that fall within already-cached months requires zero API calls.

### Manual refresh
- [x] `/settings → Data controls` gains a **"Refresh all commit data"** button.
- [x] Copy: "re-downloads your commit history from github. takes a few minutes. only do this if something looks wrong."
- [x] Clicking it clears all `gi.commits.<login>.*` keys and re-runs the progressive backfill from scratch.

### Default timeframe change
- [x] New users start with `last-30-days` instead of `last-year`. Existing users keep their stored preference.
- [ ] The migration bumps `schemaVersion` and sets `preferences.timeframe` to `last-30-days` only when the stored value is still the factory default `last-year` and the user has never explicitly changed it (heuristic: if the user-data document was created less than 1 minute before migration runs, treat as factory default). _(v3→v4 currently bumps `schemaVersion` only; `last-year` prefs are preserved — heuristic not implemented.)_

---

## Tasks

### 1. Month-chunk IndexedDB store

- [x] Create `src/api/commitCache.ts` with:
  - `MonthChunk` type: `{ month: string; login: string; byDate: Record<string, number>; timestamps: string[]; fetchedAt: string; sealed: boolean }`.
  - `getChunk(login, month)` / `setChunk(login, month, data)` / `deleteAllChunks(login)` backed by an `idb-keyval` store (`gi.commits`).
  - `listCachedMonths(login)` → sorted list of available months.
  - `isSealed(month)` — returns `true` if the month ended more than 30 days ago.
- [x] Unit tests for `isSealed` boundary (current month, previous month, 2 months ago).

### 2. Search request queue

- [x] Create `src/api/searchQueue.ts`:
  - Singleton queue that serializes `search/commits` calls: max 1 in-flight, 2-second inter-request gap.
  - `enqueue<T>(fn: () => Promise<T>, priority: 'foreground' | 'backfill'): Promise<T>` — foreground requests jump ahead of backfill.
  - `pause(seconds: number)` — called on `403`/`429`. Writes `gi.search.cooldown` to `localStorage`.
  - `resume()` — called when cooldown expires.
  - On boot, read `gi.search.cooldown` and skip requests until it expires.
- [x] Wire `makeViewerCommitsByDayFetcher` to route all `clients.rest.search.commits` calls through the queue.
- [x] Update `detectRateLimit` / `classifyError` to read `Retry-After` header and pass the value to `pause()`. _(Implemented as `retryAfterAt` on the `rate-limit` kind + `pauseSearchCommits` / `pauseAfterSearchFailure`.)_

### 3. Chunk-aware fetcher

- [x] Refactor `makeViewerCommitsByDayFetcher` (or create a new `fetchMonthChunk`) that:
  - Accepts a single `{ login, month: 'YYYY-MM' }` instead of an arbitrary date range.
  - Constructs the `search/commits` query scoped to that month's first and last day.
  - Stores the result as a `MonthChunk` in IndexedDB.
  - Returns the chunk.
- [x] The existing bisection logic for >1000-result months stays — it just operates within a single month now (rare edge case: very active month).

### 4. Cache-first query layer

- [x] Create `src/hooks/useCommitsByDayFromCache.ts` (or refactor `useViewerCommitsByDay`):
  - On mount, compute which month-chunks overlap the requested `{from, to}`.
  - Load cached chunks from IndexedDB (sync read via `idb-keyval`).
  - Determine which chunks are missing or stale (current month past `staleTime`).
  - Fire fetches only for missing/stale chunks (through the search queue).
  - Merge all chunks into a single `CommitsByDay` and return it.
  - Expose a `coverage` field: `{ total: number; loaded: number; backfilling: boolean }` for progressive UI.
- [x] Ensure the TanStack Query cache key incorporates the set of months, so timeframe switches that share months hit the cache.

### 5. Progressive backfill manager

- [ ] Create `src/api/backfill.ts`:
  - `startBackfill(login, targetMonths: string[])` — iterates `targetMonths` newest-to-oldest, fetching each missing chunk with a 15-second delay via the search queue at `'backfill'` priority.
  - Emits progress events (Zustand store or a simple event emitter) so tiles can subscribe.
  - Skips months already cached. Stops on `403`/`429` and resumes when the queue un-pauses.
  - Persists backfill cursor in `localStorage` (`gi.backfill.<login>.cursor`) so tab-close → reopen resumes.
- [x] Mount backfill in a `BackfillBoot` component (similar to `SyncBoot`): after auth + initial dashboard render, start backfilling if there are gaps in the trailing 12 months. _(Logic lives in `BackfillBoot.tsx` + `prefetchMonthIfMissing`; no separate `backfill.ts` or cursor key yet.)_

### 6. Progressive tile rendering

- [x] Update `ConsistencyTile` to render available heatmap cells immediately and fill in as chunks arrive. Empty (not-yet-loaded) cells use a distinct "pending" visual (e.g., pulsing skeleton or dimmed `--gi-heatmap-0`).
- [x] Update `StreakTile` to compute streaks from partial data with a "(loading more…)" qualifier on the current streak count.
- [x] Update `EPTile` and `WLBAuditTile` to recompute when new chunks arrive (workers already re-run on `data` change; just ensure the merged `CommitsByDay` updates reactively).
- [ ] Update `WeeklyCodingDaysTile` to mark weeks with incomplete data visually (dashed bar border, already used for partial weeks).

### 7. Default timeframe migration

- [x] Bump `CURRENT_SCHEMA_VERSION` in `src/userData/schema.ts`.
- [ ] Add migration: if `preferences.timeframe` equals the factory default `{ kind: 'preset', preset: 'last-year' }` and `updatedAt` is within 60 seconds of `createdAt` (or missing), set it to `{ kind: 'preset', preset: 'last-30-days' }`.
- [x] Existing users who explicitly chose `last-year` keep their choice (the heuristic avoids overwriting deliberate selections).
- [x] Add unit test for the migration.

### 8. Manual refresh in Settings

- [x] Add a "Refresh all commit data" button to `DataControlsSection` in `/settings`.
- [x] On click: confirm dialog → `deleteAllChunks(login)` → restart backfill → success line under buttons (not a toast): *"refreshing commit data from github. give it a few minutes — the heatmap will fill back in."*
- [x] Copy follows `spec.md §10` voice.

### 9. Retry-After handling

- [x] In `src/api/errors.ts`, extend `detectRateLimit` to read the `retry-after` response header (seconds or HTTP-date) and include `retryAfterSeconds: number | null` in the returned `rate-limit` kind. _(Field is `retryAfterAt: Date | null`.)_
- [x] In `src/api/github.ts`, when a rate-limit error includes `retryAfterSeconds`, pass it to `searchQueue.pause()`. _(via `pauseAfterSearchFailure` / rate-limit handling on search paths.)_
- [x] Update `RateLimitBanner` to show the `Retry-After`-derived countdown when available. _(via `useRateLimit` and `retryAfterAt`.)_

---

## Verification

- [x] TypeScript typecheck passes (`npm run build`). _(2026-05-02)_
- [ ] Unit tests for `commitCache`, `searchQueue`, `isSealed`, `backfill` cursor persistence, and the schema migration. — **`commitCache` (+ month sealing), `githubCommitsSearch` (overlap / trailing months), `errors` (Retry-After), schema migration (v3→v4)** covered; dedicated **`searchQueue`** + **`backfill` cursor** tests still absent.
- [ ] Manual test: fresh login → dashboard renders in <3 seconds with 30-day data; heatmap backfills visually over the next ~3 minutes; no `403` errors in the Network tab. — **Not re-run as a cold OAuth session**; partial data + **no `403`** observed after other flows; **<3s** not timed this run.
- [x] Manual test: returning user with full cache → dashboard renders instantly, 0 search requests in the Network tab for sealed months. _(Chrome DevTools MCP: full reload showed **3× GraphQL POST only**, **0×** `GET …/search/commits`.)_
- [ ] Manual test: throttle the token (or simulate with devtools) → `403` triggers 60-second pause; no retry storm; banner shows countdown; backfill resumes after pause. — **Not run** (needs intentional rate-limit or mock).
- [ ] Manual test: close tab mid-backfill → reopen → backfill resumes from last completed chunk. — **Not run** (no persisted `gi.backfill.*` cursor in code; **resume is via missing chunks + `prefetchMonthIfMissing`** — worth an explicit QA pass).
- [x] Manual test: `/settings → Refresh all commit data` → clears cache, restarts backfill. _(Confirm copy matches spec; **IndexedDB `gi.commits` keys → 0** after confirm; dashboard then repopulated chunks; **no console errors**.)_
- [x] Manual test: switch timeframe from `last-30-days` to `last-year` → cached months render instantly, only missing months are fetched. _(Switched to **last 12 months** preset; tiles updated; **no new `search/commits`** vs baseline while **13 chunks** already on disk — cache hit.)_

## Out of scope

- Migrating away from `search/commits` to GraphQL `contributionCalendar` (different data semantics — would count PRs/issues/reviews, not pure commits).
- Per-repo commit statistics endpoints (`/stats/commit_activity`) — per-repo, no author filter, more total requests for multi-repo users.
- Gist-based commit data sync (tamper risk, user can forge data).
- Service Worker offline mode.
- Compression of stored chunks (IndexedDB handles this adequately for the data sizes involved).
