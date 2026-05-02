# gitInsights - Technical Specification (OAuth + Client Side)

## 1. Vision

gitInsights is a zero-server developer identity dashboard built to feel like a native extension of GitHub. It uses OAuth to securely fetch user data and runs entirely in the browser to calculate deep analytics like Commit Momentum, future diff-weighted rollups, and WLB stats. 
Developers are often tracked by their employers for metrics like code contributions, code quality, and work-life balance. and most cases they don't get to see their own metrics. gitInsights helps developers understand their own metrics and make data-driven decisions to improve their work-life balance.

### Target Users

Working developers who spend most of their day inside private orgs and private repos. The product must be valuable for engineers whose entire commit history lives behind GitHub permissions, not just open-source contributors.

### Success Metrics

- Time-to-first-insight after login: < 10 seconds.
- Heatmap and Commit Momentum fully rendered for the last 12 months: < 5 seconds on cached load.
- Zero server-side persistence of user data or tokens.

### Non-Goals

- No team / org-wide analytics dashboards (single-user identity only).
- No paid tier, no billing.
- No server-side database. The Vercel function is for OAuth token exchange only.
- No write operations against the GitHub API (read-only product).

### Glossary

- **Commit Momentum**: rolling 365-day score: each qualifying commit contributes `RecencyWeight` only (recent work counts more). Computed from the same pure non-merge commit set as the Consistency Map — no per-commit diff hydration in v1. The Bento grid area is still labeled `EP` in code for layout stability.
- **Diff Delta**: a per-commit weight from additions, deletions, files touched, merge penalty, and vendor path ratio (see §6). Reserved for a **future** diff-weighted momentum mode; not multiplied into the shipped Commit Momentum total until per-commit stats are fetched.
- **WLB Audit**: Work-Life-Balance audit. Bucketed analysis of commit timestamps (hour-of-day, day-of-week, weekend ratio, late-night ratio).
- **Consistency Map**: 53-week × 7-day grid visualization of pure non-merge commits across all repos (public + private). Implemented as a custom CSS-grid component (no third-party heatmap library).
- **PTO (Paid Time Off)**: user-marked off-days. Excluded from all "expected work" denominators; rendered with a distinct color on the Consistency Map.
- **Public Holidays**: auto-imported off-days for the user's selected region(s) (e.g., US, IN, GB-ENG). Treated like PTO in every metric; differentiated only in tooltip / source.
- **Off-day**: any day excluded from "expected work" — i.e., a non-workday OR a PTO day OR a Public Holiday (minus user overrides). The single concept that drives streak skipping, Weekly Coding Days denominators, and WLB ratios.
- **Weekly Coding Days**: number of distinct days per Sunday-Saturday week with ≥ 1 contribution; off-days are excluded from both numerator and denominator.
- **Workweek**: the set of weekdays the user considers "working days". User-configurable; defaults to Mon–Fri. Drives weekend behavior across all time-based metrics.

## 2. Tech Stack (The GitHub-Native Stack)

- Language: TypeScript (strict mode).
- Framework: React 19 + Vite.
- Routing: React Router v6.
- Data layer: TanStack Query, persisted to IndexedDB via `@tanstack/query-async-storage-persister` + `idb-keyval`.
- GitHub client: `@octokit/graphql` and `@octokit/rest` (fallback for endpoints not in GraphQL).
- State: Zustand for UI state; TanStack Query owns server state.
- UI components: **Mantine** (`@mantine/core`, `@mantine/hooks`). All UI is built from Mantine primitives or thin wrappers/extensions of them. **No raw HTML components.** If a Mantine primitive doesn't quite fit, extend or compose Mantine — don't bypass it. Anything that smells like "should we add a Mantine sub-package?" or "should we drop down to a raw `<div>`?" gets raised for review before code lands.
- Component add-ons (pulled in as features land): `@mantine/dates` (PTO calendar, month-view picker, ranges), `@mantine/form` (settings forms), `@mantine/notifications` (toasts), `@mantine/modals` (confirm dialogs). All optional; add only when the owning feature ships.
- Custom styling: **Styled Components** sits *on top of* Mantine for the two narrow cases where Mantine's `style` / `classNames` / `styles` props aren't enough: (1) authoring app-specific custom CSS (animations, complex layout patterns, bespoke chart containers), and (2) extending a Mantine component into a domain primitive (e.g. `BentoTile = styled(Card)`, `StatNumber = styled(Text)`). Styled Components must always wrap a Mantine component or a Mantine layout primitive (`Box`, `Group`, `Stack`, `Paper`, `Card`, etc.) — never a raw `<div>` / `<span>` / `<button>`. All `styled(...)` definitions read from the Mantine theme (`({ theme }) => theme.colors...`); no hard-coded colors.
- Theming: Mantine's `MantineProvider` is configured from `@primer/primitives` — Primer's `dark` and `light` palettes, typography, and spacing tokens are mapped into Mantine's theme (`theme.colors`, `theme.spacing`, `theme.radius`, `theme.fontFamily`, …). Components inherit Primer-correct colors automatically; no hard-coded hex/rgb anywhere in the codebase. Styled Components share the same Mantine theme via `<ThemeProvider theme={mantineTheme}>` so `styled(Card)` definitions read the same tokens.
- Icons: GitHub Octicons via `@primer/octicons-react`. Mantine slots that accept icons (e.g. `Button leftSection`, `TextInput leftSection`, `ActionIcon`) take Octicon React nodes directly.
- Visuals: the Consistency Map ships as a custom CSS-grid component built on `styled(Box)` primitives (53-col × 7-row, `aspect-ratio: 1` cells, CSS variables `--gi-heatmap-0..4` for the intensity ramp). Light-mode empty-cell contrast vs Bento chrome is defined with `--gi-bento-tile-bg` (see **§4** Cross-cutting theming). Recharts (axes/tooltips driven by the Mantine theme; `@mantine/charts` is acceptable when it cleanly wraps the chart we need) handles the WLB histogram and other future charts.
- Date utilities: date-fns.
- Heavy compute: Web Workers (via Comlink) for Commit Momentum and WLB rollups.
- Authentication: GitHub OAuth 2.0 via Serverless Proxy (Vercel Function).
- Quality: ESLint, Prettier, Husky + lint-staged, TypeScript `--noEmit` in CI.
- Runtime: Node 22 LTS, npm.
- Deployment: GitHub Pages (app) + Vercel (token proxy).

## 3. Architecture Logic

### A. Authentication (The OAuth Flow)

To keep the app serverless while handling OAuth:

- User clicks Login: App redirects to GitHub OAuth authorize endpoint.
- Redirect Back: GitHub sends a code to our GH Pages URL.
- Token Exchange: The app sends this code to a tiny Token Proxy (hosted on Vercel/Netlify) to exchange it for an access_token.

Implementation Reference: See api/authenticate.js.

#### OAuth Scopes

Default (requested at first login):

- `read:user` — profile info.
- `user:email` — primary email for identity.
- `repo` — read access to private repos (commit history, diffs, metadata). Required; `public_repo` alone is insufficient for the product's value prop.
- `read:org` — discover the orgs the user belongs to so private contributions are countable.

Incremental (requested only when the user enables a feature that needs it):

- `gist` — required for cross-device settings sync (see §3.G). Requested via a re-authorization flow when the user toggles **Sync** on in `/settings`. Users who never enable sync never grant this scope.

The login screen must clearly explain why `repo` is requested and that data never leaves the browser. The sync opt-in must clearly explain that `gist` grants gitInsights read/write to **all** the user's gists (a GitHub OAuth limitation), and that gitInsights only reads/writes its own.

#### Token Lifecycle

- Access token is stored in `localStorage` under a single namespaced key (e.g. `gi.auth.token`).
- On boot, the app validates the token with a cheap `viewer { login }` query; on 401 it clears storage and redirects to `/`.
- Logout clears all `gi.*` keys plus the IndexedDB cache.
- We do not refresh tokens; GitHub user-to-server tokens for OAuth Apps are long-lived. (If we later migrate to a GitHub App, we'll add refresh handling.)

### B. SPA Routing Hack (GitHub Pages)

We use the redirection hack to handle the OAuth callback URL and nested paths:

- Link: https://github.com/rafgraph/spa-github-pages/blob/gh-pages/index.html
- 404.html: Catches callback routes and redirects to index.html with the code in query params.
- index.html: Restores the state for the React app.

### C. Token Proxy Contract (Vercel Function)

Reference implementation: `docs/oauth-token-proxy-example.js` (illustrative, not final).

- Hosting: Vercel, file at `/api/authenticate.ts` in a separate proxy repo (or same repo if we use Vercel for both).
- Method: `POST` only; all other methods → `405`.
- Request body: `{ "code": string }`.
- Success response: `{ "access_token": string, "token_type": "bearer", "scope": string }` from GitHub, returned as-is.
- Error response: `{ "error": string, "error_description"?: string }` with appropriate `4xx`/`5xx`.
- CORS: `Access-Control-Allow-Origin` restricted to the GH Pages origin (no `*`).
- Env vars (Vercel dashboard): `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `ALLOWED_ORIGIN`.
- Logging: no request bodies, no tokens, no PII. Only counters / status codes.
- Should be rewritten in TypeScript and add the CORS allowlist + a basic in-memory rate limit before production.

### D. Rate Limiting & Caching

- GitHub GraphQL: 5,000 points/hour authenticated. We treat this as a hard ceiling.
- TanStack Query is the single read path for all GitHub data.
- Persist the query cache to IndexedDB so repeat sessions don't re-spend the rate budget.
- Default `staleTime`: 1 hour for contribution/commit history, 24 hours for repo metadata, 5 minutes for `viewer`.
- On `403` rate-limit response: surface a non-blocking banner with the reset time and serve cached data.
- Pagination: cursor-based via GraphQL `pageInfo`; cap at a configurable max (e.g., 5,000 commits per repo per fetch) with a "load more" affordance.

#### D.1 Incremental Commit Cache (search/commits)

The `GET /search/commits` endpoint sits in GitHub's `search` rate bucket (30 requests/minute, aggressive secondary limits). A cold dashboard load for a 12-month window can fan out to 10+ paginated pages and trigger secondary rate-limit `403`s — even when the hourly quota is nowhere near exhausted.

**Core insight**: commits older than ~30 days are historical; they don't change. The app should fetch them once, store them locally forever, and never re-request them.

**Month-chunk architecture**:

- The 365-day window is split into calendar-month chunks (`2026-01`, `2026-02`, …). Each chunk stores its own `byDate` map and `timestamps` array in IndexedDB under `gi.commits.<login>.<month>`.
- A chunk is **sealed** once its month is more than 30 days in the past. Sealed chunks are never re-fetched unless the user explicitly requests a full refresh.
- The **current month** chunk (and optionally the previous month) is the only one refetched on each visit, using the same `search/commits` query scoped to that month's date range — typically 1 page, 1 API call.
- When tiles request a date range, the cache layer assembles the response by merging the relevant month-chunks. If any chunk is missing, only that chunk is fetched — not the entire range.

**Progressive backfill on first load**:

- Default timeframe on first-ever login: `last-30-days`. The app fetches only the current month (1–2 search pages), renders the dashboard immediately.
- A background backfill job walks backwards month-by-month towards 12 months ago, with a **15-second delay** between each chunk fetch. This spreads ~12 requests over ~3 minutes instead of bursting them all at once.
- Backfill progress is visible in the UI (e.g., heatmap cells filling in from right to left, a subtle "loading older data…" indicator on affected tiles).
- If the user closes the tab mid-backfill, completed chunks persist; the next visit resumes from the first missing chunk.

**Returning-user fast path**:

- On subsequent visits, sealed month-chunks load from IndexedDB (instant, zero API calls). Only the gap between the last cached date and today is fetched — typically 0–few days, 1 API call.
- The `staleTime` for the current-month chunk remains 1 hour (spec §3.D). Sealed chunks have effectively infinite `staleTime`.

**Request throttle** (secondary rate-limit defense):

- A global request queue for `search/commits` allows at most **1 in-flight search request** at a time with a minimum 2-second gap between consecutive requests.
- On any `403`/`429` response: read `Retry-After` if present; otherwise pause for 60 seconds. Persist the cooldown timestamp in `localStorage` (`gi.search.cooldown`) so all tabs and page reloads respect it.
- The queue applies to both foreground fetches and background backfill.

**Manual refresh**:

- `/settings → Data controls` gains a **"Refresh all commit data"** action that clears all month-chunks and re-runs the progressive backfill. Copy: "re-downloads your commit history from github. takes a few minutes. only do this if something looks wrong."

### E. Heavy Compute (Web Workers)

Commit Momentum and WLB rollups can iterate over tens of thousands of commits. Run them off the main thread:

- One worker module per heavy job (`commitMomentum.worker.ts`, `wlbAudit.worker.ts`).
- Wrap with Comlink for ergonomic typed calls.
- Workers receive raw commit arrays and return summarized metrics; no network calls inside workers.
- Memoize results in IndexedDB keyed by `(userId, repoId, sha-range)`.

### F. Local User Data (PTO, Preferences)

Some product data is user-authored, not GitHub-derived (PTO calendar, streak mode, bento layout, tile toggles). It must persist locally without a backend:

- Storage: IndexedDB store `gi.user-data`, keyed by `viewer.login` so multiple GitHub accounts on the same browser stay isolated.
- Shape: a single versioned JSON document (`schemaVersion`, `preferences`, `pto`); migrations live alongside the schema.
- Cross-device sync: optional, opt-in, via a private GitHub Gist owned by the user. See §3.G for the full sync model.
- Export / Import: a JSON download/upload in `/settings` so users can move data between browsers manually (works regardless of whether sync is enabled).
- Lifecycle: cleared by "Clear local cache" and full logout. Never sent to any server (including the Vercel proxy).

### G. Cross-Device Sync (Optional, GitHub Gist)

For a consistent experience across machines, users can opt in to syncing their `gi.user-data` document via a **private GitHub Gist** in their own GitHub account. Off by default; enabling it is the only thing that triggers the `gist` OAuth scope grant.

The full data model, sync triggers, conflict resolution, failure / offline behavior, disable / wipe semantics, and the all-gists privacy trade-off live in [`features/gist-sync.md`](./features/gist-sync.md).

### H. Error Handling Strategy

- Network / 5xx: retry with TanStack Query defaults (3 attempts, exponential backoff), then show inline error tile with retry button.
- 401 / token invalid: clear auth, redirect to `/`.
- 403 rate limit: banner with reset time, keep showing cached data.
- 403 SAML / SSO required: actionable message linking to the user's org SSO authorization page.
- Empty data (new account, no commits): friendly empty state per tile, never a blank screen.
- All error and empty-state strings are written in the voice defined in §10 — direct, blunt, never generic ("github rate-limited us. resets at 14:32." not "An error occurred.").

## 4. App Sitemap (The Pages)

### A. Landing / Login Page (/)

- Hero section explaining the "Main Character" dev energy with gitInsights branding.
- Large "Login with GitHub" button.
- Scope disclosure block: lists the OAuth scopes we request and a one-liner on why each is needed.

### B. OAuth Callback (/callback)

- Reads `?code=` from the URL, POSTs to the Vercel proxy, stores the resulting `access_token`, then redirects to `/dashboard`.
- Loading and error states only; not user-facing for long.

### C. Main Analytics Dashboard (/dashboard)

- The Bento Grid: Your private view of all stats.
- Features: Commit Momentum (Bento `EP`), Consistency Map, Weekly Coding Days, WLB Audit, and Tech Stack.
- The Consistency Map renders PTO days in a distinct color (see [`features/pto.md`](./features/pto.md)) so the user can visually separate "rested" from "missed".
- Each tile defines its own loading skeleton, empty state, and error state.
- **Global Timeframe Filter**: a single dashboard-level control that scopes every tile *except* the Consistency Map (which is fixed at 53 weeks by definition). Full spec: [`features/global-timeframe.md`](./features/global-timeframe.md).

### D. Live Public Profile (/u/:username)

- The Showoff Page: A read-only, aesthetic version of the dashboard for public flex.
- _Implementation model TBD — revisit later._

### E. Customization & Settings (/settings)

- View Config: Toggle Bento tiles and manage privacy.
- Theme: pick `system` (default) / `dark` / `light`. `system` follows the OS preference live (responds to `prefers-color-scheme` changes without a reload).
- Workweek: pick which weekdays count as working days (default Mon–Fri). Presets for Mon–Fri, Sun–Thu, and Mon–Thu (4-day week), plus a custom multi-select of any weekday combination. Full semantics in [`features/workweek.md`](./features/workweek.md).
- Streak mode: pick `strict` / `skip-non-workdays` (default) / `workdays-only` — see [`features/consistency-streaks.md`](./features/consistency-streaks.md) for semantics.
- PTO Calendar: a month-view picker to mark/unmark off-days. Supports single-day toggle, range selection (e.g., Dec 23 – Jan 2), an optional short label per entry ("Vacation", "Sick", "Public Holiday"), and a list view to bulk-edit/delete. Marked days update every dependent metric live.
- Public Holidays: a region multi-select (search + ISO 3166 codes; e.g., US, IN, GB-ENG). Off by default. Once enabled, the chosen region's holidays auto-fill as off-days across every metric and on the heatmap. A list view shows upcoming holidays for the year; each row has an "I worked that day" override that flips it back to a workday without disabling the whole feature. Voice copy in §10.
- Sync (cross-device): off by default. A toggle starts the `gist`-scope re-auth flow described in §3.G; once enabled, shows last-sync time, a **Sync now** button, and a destructive **Delete cloud copy** action. Status messages follow §10 voice ("synced 12 seconds ago", "couldn't reach github. local data is fine.").
- Data controls: "Clear local cache", "Logout", "Revoke GitHub authorization" (link to GitHub settings), "Export user data (JSON)", "Import user data (JSON)".

### F. Not Found (\*)

- Branded 404 inside the app for any unmatched route. Distinct from the GH Pages `public/404.html` SPA-redirect file.

### G. Global app header (shared `AppShell`)

- **Code:** `src/components/AppShell.tsx` — `MantineAppShell` wraps all routes: fixed-height header, main with landing vs padded `Container` layout, `RateLimitBanner` placement as implemented.
- **Signed-in — at `sm` and wider (Mantine `sm` = 48em):** A centered row of pill `Button`s + `RouterNavLink` for **dashboard**, **profile** (`/u/:login`), and **settings**. The row sits in a `Group` with `visibleFrom="sm"` so it does not occupy horizontal space on narrow phones (avoids clipped labels and crowding next to the cache pill and avatar).
- **Signed-in — below `sm`:** The pill row is hidden. **dashboard**, **profile**, and **settings** are listed in the **avatar** `Menu` instead: they render after the account identity block (`Menu.Label`), before **privacy**, with dividers separating blocks. Active route uses the same semantics as the pills (`menuNavItemStyles` + pathname checks). Whether those three items appear in the dropdown follows `useMediaQuery('(min-width: ${theme.breakpoints.sm})', …, { getInitialValueInEffect: false })` so it stays aligned with the pill row’s `visibleFrom="sm"`: at `sm+` the menu lists identity → **privacy** → **log out** only (primary routes stay in the header pills); below `sm` the same three routes are included after the identity block. Menu width is ~240px; choosing a link closes the menu via normal `Menu.Item` behavior.
- **Signed-in — right cluster:** Cache freshness pill (green status dot + `cache · …` copy; label text uses `visibleFrom="xs"`), then the avatar `Menu` target (`Avatar` with `aria-label` derived from `viewer.login`). Pill `Button`s use `headerNavPillStyles` so light-mode `subtle` + `gray` labels resolve to Primer foreground tokens (`--gi-fg-default`).
- **Signed-out:** A flex spacer plus inline **privacy** and **log in** (`Button`s); there is no hamburger or drawer for marketing/auth chrome.
- **Brand:** Favicon + lowercase **gitinsights** `Text` link to `/`.
- **A11y:** Avatar-triggered `Menu` follows Mantine’s menu keyboard model and dismisses on `Escape`. The avatar trigger exposes a descriptive `aria-label` (e.g. `{login} account menu`).

### Cross-cutting UI Requirements

- Responsive: works from 360px mobile up to ultra-wide desktop. Bento collapses to a single column on narrow viewports; the global header follows the responsive rules in **§4.G** so navigation stays usable without clipped labels.
- Accessibility: WCAG 2.1 AA. Keyboard navigable, visible focus rings, charts have text/table fallbacks, color is never the only signal.
- Component policy: **every UI element is a Mantine component or a thin extension of one.** We do not author raw HTML components for things Mantine already covers (buttons, inputs, modals, popovers, tooltips, tables, badges, menus, drawers, layout primitives, cards, etc.). When Mantine doesn't ship the exact primitive we need, extend or compose Mantine — Styled Components is the allowed extension mechanism, but `styled(...)` must wrap a Mantine component or layout primitive (`Box`, `Group`, `Stack`, `Paper`, `Card`, …), never a raw HTML element. Custom CSS (animations, bespoke layout, chart containers) is authored via Styled Components on top of those Mantine primitives. If even that feels wrong, raise it for review **before** writing custom HTML. Third-party charts (Recharts) are wrapped in a Mantine container and themed via the Mantine theme.
- Theming: ships with both dark and light themes, built on GitHub Primer color tokens (Primer Primitives `dark` + `light` palettes) and consumed through the Mantine theme. Default is `system`, following `prefers-color-scheme`; user can override to `dark` or `light` from `/settings`. The chosen mode persists in `gi.user-data` (see §3.F) and toggles Mantine's `colorScheme`. All themed surfaces — Bento tiles, the Consistency Map intensity scale (`--gi-heatmap-0..4`), Recharts axes/tooltips, focus rings, status colors — resolve through the Mantine theme; no hard-coded colors. `<meta name="color-scheme" content="dark light">` set in `index.html` so native form controls and scrollbars match.
- **Bento tile surface + heatmap level 0 (light mode):** `cssVariablesResolver` in `src/theme/mantine-theme.ts` defines `--gi-bento-tile-bg`: in **light** it maps to Primer `bgMuted` (off-white card), in **dark** to `bgSubtle` (same effective fill Bento used before the token split). `BentoTile` (`src/components/Bento/BentoTile.tsx`) uses `background: var(--gi-bento-tile-bg)`. **Light** `--gi-heatmap-0` is Primer `bgSubtle`, so empty Consistency Map cells are a slightly darker grey than the tile — a GitHub-style grid where level 0 is visible without looking washed out. **Dark** `--gi-heatmap-0` remains `bgMuted` on the dark bento surface. Levels **1–4** stay the Primer green ramp (`primerLight` / `primerDark` greens) as before. Other settings surfaces that still use `--gi-bg-subtle` are unchanged.

## 5. Security & Privacy

- Client Secret remains hidden in the proxy.
- All data processing happens locally in the browser.
- Access token lives only in the user's browser (`localStorage`); never sent anywhere except `api.github.com`.
- User-authored data (PTO calendar, preferences) lives only in IndexedDB on the user's device by default; the only exception is **opt-in cross-device sync** (§3.G), which writes the same document to a **private Gist in the user's own GitHub account** — and the opt-in dialog must say so plainly. Commit data, diffs, and computed analytics are never synced.
- Vercel proxy logs no bodies, no tokens, no PII; CORS is locked to the GH Pages origin.
- Public profile pages (when implemented) require explicit owner opt-in and never expose private repo data.
- No third-party analytics, trackers, or fonts loaded from external CDNs.
- `<meta http-equiv="Content-Security-Policy">` set in `index.html` to restrict script/style/connect sources to GitHub + the proxy origin.
- Logout clears `localStorage` and IndexedDB; settings page links the user to GitHub's "Authorized OAuth Apps" page to fully revoke.

## 6. Data Model & Metric Definitions

This section is the index. Each feature has a deep specification in [`docs/features/`](./features/) — that's where the full data model, resolution rules, edge cases, and per-metric effects live. Keep this section short on purpose; everything below is a one- or two-paragraph summary so you can decide which feature file to open.

### Off-day primitives

These three concepts are the substrate for every time-based metric. Every metric routes through a single `isOffDay(date)` helper that returns true if the date is a non-workday OR a PTO day OR a Public Holiday (minus user overrides).

- **Workweek** — user-authored set of weekdays considered "working days" (default Mon–Fri). Single source of truth for "the user was expected to work on this day-of-week". Full spec: [`features/workweek.md`](./features/workweek.md).
- **PTO (Paid Time Off)** — user-authored off-days. Excluded from "expected work" denominators; never breaks streaks; rendered with a distinct color on the Consistency Map. Full spec: [`features/pto.md`](./features/pto.md).
- **Public Holidays** — auto-imported off-days for the user's selected region(s) from a build-time bundled dataset (no runtime third-party calls). Treated identically to PTO at consumption time; differentiated only in source and tooltip copy. Full spec: [`features/public-holidays.md`](./features/public-holidays.md).

### Window control

- **Global Timeframe Filter** — a single dashboard-level control that scopes every tile *except* the Consistency Map. Presets (`last-week`, `last-30-days`, `last-3-months`, `last-6-months`, `last-year`), specific month, specific quarter, or a custom range; **hard 365-day cap**; default `last-30-days` (changed from `last-year` in Phase 11 — see §3.D.1; wider windows backfill progressively). Stored in `gi.user-data.preferences.timeframe` and synced via §3.G. Every dependent tile reads from one `resolveTimeframe(tf, now)` helper. Full spec: [`features/global-timeframe.md`](./features/global-timeframe.md).

### Metrics

- **Commit Momentum** (Bento `EP`) — recency-weighted sum of pure non-merge commits in the window. `RecencyWeight` decays linearly from 1.0 (now) to 0.25 (365 days ago). Includes the future Diff Delta extension (per-commit diff-size weighting) as a forward-compatible pure function. Full spec: [`features/commit-momentum.md`](./features/commit-momentum.md).
- **Consistency Map & Streak Modes** — 53-week × 7-day heatmap of pure non-merge commits (custom CSS-grid component). Three streak modes: `strict`, `skip-non-workdays` (default), `workdays-only`. The heatmap and its streak counters are **exempt from the Global Timeframe** and stay pinned to the trailing 53 weeks. Full spec: [`features/consistency-streaks.md`](./features/consistency-streaks.md).
- **Weekly Coding Days** — per Sunday-Saturday week `activeDays / effectiveWorkingDays` ratio with a **timeframe-aware bucketed histogram** (per-week → bi-weekly → per-month) so the bar count stays in a readable 4–14 range. Full spec: [`features/weekly-coding-days.md`](./features/weekly-coding-days.md).
- **WLB Audit** — `LateNightRatio`, `NonWorkdayRatio`, `HourHistogram`, `LongestStreakDays`, `LongestBreakDays`, plus PTO-aware metrics (`PTODaysTaken`, `PTOHonoredRatio`, `PTOViolationCount`). Every metric ships with a one-liner verdict in §10 voice. Full spec: [`features/wlb-audit.md`](./features/wlb-audit.md).
- **Tech Stack Inference** — top languages by weighted bytes across owned + contributed repos within the Global Timeframe. Full spec: [`features/tech-stack.md`](./features/tech-stack.md).

## 7. GitHub API Surface

Primary GraphQL queries (names are illustrative):

- `viewerProfile`: `viewer { login, name, avatarUrl, createdAt }`.
- `viewerContributions(from, to)`: `viewer { contributionsCollection(from, to) { contributionCalendar { totalContributions, weeks { contributionDays { date, contributionCount } } }, commitContributionsByRepository { repository { nameWithOwner, isPrivate }, contributions { totalCount } } } }`. Used for "all activity" surfaces only — **not** the Consistency Map (`contributionCount` includes PRs, issues, reviews, comments, approvals; the heatmap wants pure commits).
- `viewerOrgs`: `viewer { organizations(first: 50) { nodes { login } } }`.
- `repoCommitHistory(owner, name, since, until, after)`: paginated commit history with `additions`, `deletions`, `changedFilesIfAvailable`, `committedDate`, `author`.
- `repoLanguages(owner, name)`: top languages by bytes.

REST endpoints via `@octokit/rest`:

- `GET /search/commits` with `q=author:{login} author-date:{from}..{to} merge:false` — **the Consistency Map data source.** Returns pure non-merge commits authored by the viewer in the window, public + private. Adaptive pagination: try the whole window in one query, recursively bisect the date range when `total_count` exceeds GitHub's 1000-result cap. Aggregated client-side into `Record<isoDate, count>`. Note GitHub's contribution-graph caveat applies: only commits whose author email is one of the viewer's verified emails are attributed.
- `GET /user` — primary email if not exposed via GraphQL.
- `GET /repos/{owner}/{repo}/commits/{sha}` — file-level diff stats when GraphQL omits them.

Cache TTLs: see §3.D.

## 8. Folder Structure

```
gitInsights/
├── api/                          # Vercel function(s)
│   └── authenticate.ts
├── public/
│   ├── 404.html                  # SPA redirect hack
│   └── favicon.svg
├── src/
│   ├── analytics/                # pure functions: commitMomentum, diffDelta, wlb, consistency
│   ├── api/                      # octokit clients, query definitions
│   ├── components/               # presentational components
│   ├── hooks/                    # useAuth, useGitHub, useBentoConfig
│   ├── pages/                    # route components
│   ├── store/                    # zustand stores
│   ├── theme/                    # Mantine theme config + Primer token mapping (dark/light)
│   ├── workers/                  # commitMomentum.worker.ts, wlbAudit.worker.ts
│   ├── App.tsx
│   └── main.tsx
├── tests/
│   ├── unit/
│   └── e2e/
├── .env.example
├── .nvmrc
├── package.json
└── vite.config.ts
```

## 9. Environment Variables

Frontend (Vite, must be prefixed `VITE_`):

- `VITE_GITHUB_CLIENT_ID` — public OAuth App client ID.
- `VITE_PROXY_URL` — full URL to the Vercel token-exchange function.
- `VITE_OAUTH_REDIRECT_URI` — the GH Pages callback URL.

Proxy (Vercel, server-side only):

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `ALLOWED_ORIGIN` — exact origin allowed by CORS.

A committed `.env.example` mirrors the frontend keys with empty values.

## 10. Voice & Copy

gitInsights has a single, consistent voice across every user-facing string — UI labels, empty states, error messages, WLB audit summaries, scope disclosures, marketing copy. This is non-negotiable; engineers and designers must write to it.

### The Vibe

Brutalist, pro work-life balance, anti-burnout, anti-toxic-workplace, gen-z native. We're the friend who says "log off" when you've been at it for 11 hours. We don't sound like an HR portal, a corporate wellness app, or a productivity tracker for managers. We sound like the developer is the main character — because they are.

### Principles

- **Short and direct.** Brutalist means few words, no padding, no "we're sorry to inform you that". Lowercase is fine when it serves the vibe; full sentences not required for status copy.
- **Pro-rest, anti-grind.** Rest is a feature, not a failure. Streaks survive PTO and weekends. Long breaks are celebrated, not flagged. We never use "productivity", "output velocity", or "performance" — those are the boss's words.
- **Name the toxic patterns out loud.** Late-night commits, weekend work, PTO violations, 30-day no-rest streaks: we surface these directly, without softening into corporate "wellness check" tone. The user owns what they do with that info; we don't lecture.
- **The user is on their side.** Copy frames data as ammo against opaque manager dashboards, not material for one. Never imply the user should work more, harder, or longer.
- **No moralizing, no shame.** "you committed at 2am 4 nights this week" is fine. "you should be ashamed" or "this is bad for you" is not.
- **No emoji clutter.** Sparing use of GitHub-native iconography (Octicons) and small textual signals; no emoji-as-decoration. Adding emoji is opt-in via design review, never default.
- **Internet-native, not cringe.** We can be casual and direct. We don't reach for memes that will date the product in 6 months ("rizz", "gyatt", current trend slang) or speak in third-person AI voice ("as your insights companion…").
- **Accessibility is voice too.** Every string must work for a screen reader. No copy that depends on visual layout, color, or emoji to make sense.

### Don't / Do

- WLB audit, late nights:
  - Don't: "You worked late on 12 nights last month. Consider a healthier sleep schedule."
  - Do: "12 nights past 22:00 last month. that's a lot. log off."
- WLB audit, weekend work:
  - Don't: "Great hustle on weekends!"
  - Do: "5 of 8 weekend days had commits. weekends are not a feature."
- PTO violation:
  - Don't: "You committed during your scheduled time off. We hope everything is okay."
  - Do: "you marked dec 27 as PTO and pushed 3 commits. it's PTO. close the laptop."
- Healthy streak break (`skip-non-workdays`):
  - Don't: "Your streak ended."
  - Do: "took the weekend off. streak intact."
- Empty state, no commits in window:
  - Don't: "No data available."
  - Do: "nothing here yet. either you're new, on PTO, or actually resting. all valid."
- Scope disclosure, login:
  - Don't: "We require permissions to access your repositories to provide our services."
  - Do: "we read your private repos because that's where the work actually lives. nothing leaves your browser. promise."
- Rate-limit error:
  - Don't: "An error occurred. Please try again later."
  - Do: "github rate-limited us. resets at 14:32. cached data below."
- Auth expired:
  - Don't: "Your session has expired. Please log in again."
  - Do: "github logged you out. log back in to keep going."
- Long no-rest streak (anti-burnout nudge):
  - Don't: "Impressive consistency!"
  - Do: "47 workdays straight, 0 PTO. when's the last time you took a day?"
- Marketing / landing hero:
  - Don't: "Track your developer productivity and hit your goals."
  - Do: "your commits, your story. not your boss's dashboard."

### Forbidden Words

Avoid these in any user-facing string:

- productivity, output, velocity, performance, KPI, hustle, grind (positive framing)
- "we're sorry to inform you", "unfortunately", "please be advised"
- crush it, slay (as marketing verbs), boss up
- wellness journey, mindfulness moment, take care of yourself (saccharine)
- generic "Oops!" / "Something went wrong" — always say *what* went wrong

### Where This Applies

Every screen and string, including but not limited to:

- §3.H error handling (auth expired, rate limit, SAML, network, empty data).
- §4.A scope disclosure on the login page.
- §4.E settings labels, especially around PTO ("mark as PTO", "actually rest", etc.).
- WLB Audit tile copy ([`features/wlb-audit.md`](./features/wlb-audit.md)): every metric needs a one-liner verdict in this voice.
- Streak Modes labels ([`features/consistency-streaks.md`](./features/consistency-streaks.md)): prefer human phrasing ("strict", "skip non-workdays", "workdays only" → reasonable; UI may humanize further like "every day or it doesn't count" / "weekends don't break me" / "only workdays count" — design pass to finalize).
- 404 page, OG image / social preview, README.

When in doubt, ask: *would the developer's most direct friend say this, or would their manager's HR portal?* If it's the second, rewrite.

## 11. Open Questions / Decisions Log

- [ ] Public profile model (`/u/:username`) — visitor's token vs published JSON snapshot. _Owner decision pending._
- [ ] Migration path from OAuth App to GitHub App (better scoping, finer-grained permissions, refresh tokens).
- [ ] Public Holidays: optional custom .ics import for users in regions not covered by the bundled dataset.
- [ ] Achievements & badges: a widget on the dashboard plus a dedicated page. The badge taxonomy itself is undefined and needs a design pass before any task work begins.

## 12. Implementation Tasks

Implementation work is tracked per phase under [`docs/tasks/`](./tasks/) — `backlog/` for queued work, `archive/` for shipped phases. Each task file references the spec section(s) and feature file(s) it implements; this section is intentionally just a pointer so the spec stays a "what / why" document and the tasks folder stays the "how / when".

