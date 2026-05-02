# Feature — Global Timeframe Filter

A dashboard-level filter that scopes the data window for every tile except the Consistency Map. One control, one source of truth — every dependent tile reads the same resolved `{from, to}` range so cross-tile comparisons are always over the same window.

**Spec refs**: linked from `docs/spec.md §4.C Dashboard` and `docs/spec.md §6`.
**Implementation plan**: [`docs/tasks/backlog/phase-09-global-timeframe-filter.md`](../tasks/backlog/phase-09-global-timeframe-filter.md).

## Data model

- `Timeframe = { kind: 'preset', preset: PresetId } | { kind: 'month', year: number, month: 1..12 } | { kind: 'quarter', year: number, quarter: 1..4 } | { kind: 'custom', from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }` (all dates in the user's local TZ).
- `PresetId = 'last-week' | 'last-30-days' | 'last-3-months' | 'last-6-months' | 'last-year'`.
- Default: `{ kind: 'preset', preset: 'last-30-days' }` (rolling 30 days ending today). Changed from `last-year` in Phase 11 (see `spec.md §3.D.1`) — wider windows are progressively backfilled to avoid secondary rate limits on first load.
- **Maximum window: 365 days.** This is a hard cap across every `kind` — no preset, month, quarter, or custom range may resolve to a window longer than 365 days. The cap keeps GitHub API spend bounded, keeps worker compute predictable, and aligns every tile with the trailing-year horizon the Consistency Map already uses.
- Stored under `gi.user-data.preferences.timeframe`; syncs via the gist sync feature (see [`gist-sync.md`](./gist-sync.md)). Persisted across reloads; resets to default only via an explicit "reset" action in the picker.
- Resolution: a single `resolveTimeframe(tf, now)` helper returns `{ from: Date, to: Date, label: string }` — every tile reads from this, no tile re-derives ranges from the raw `Timeframe`.

## UI

- Lives in the dashboard header, above the Bento grid; sticky on scroll on wide viewports, collapses into a compact pill on narrow.
- Built from Mantine primitives: a `Menu` / `Popover` triggered by a pill `Button` showing the resolved label ("last 12 months", "mar 2026", "q1 2026", "feb 3 – feb 28").
- Picker contents (in order): preset list, month picker (`@mantine/dates` `MonthPicker`), quarter picker, custom range calendar (`DatePicker type="range"`).

## Scope across tiles

- **Applies to:** Commit Momentum, Weekly Coding Days, WLB Audit, Tech Stack, and any future tile that reports time-bound metrics.
- **Does NOT apply to:** the Consistency Map. The heatmap is intentionally fixed at the trailing 53 weeks regardless of the timeframe selection.

## Metric semantics under a custom timeframe

Every metric definition is written against an abstract "window". When the global timeframe changes, the window each metric uses changes with it:

- **Commit Momentum**: replaces the "rolling 365 days" window with the resolved `{from, to}`. `RecencyWeight` continues to decay linearly from 1.0 at `to` to 0.25 at `from`; commits outside the window contribute 0. The displayed total and sparkline both reflect the selected window.
- **Weekly Coding Days**: the per-week sparkline becomes a **bucketed histogram** that adapts to the window length (per-week → bi-weekly → per-month). See "Histogram bucketing" in [`weekly-coding-days.md`](./weekly-coding-days.md). "Current week" shown only when the window includes today; otherwise the tile shows the latest week of the selected window.
- **WLB Audit**: every ratio (`LateNightRatio`, `NonWorkdayRatio`, `PTOHonoredRatio`, `PTOViolationCount`, `HourHistogram`, `LongestStreakDays`, `LongestBreakDays`) is computed over commits in the window. Off-day exclusion rules are unchanged.
- **Tech Stack Inference**: replaces the hard-coded "last 12 months" with the selected window. Repos with zero contributions in the window drop out.

## Edge cases

- Custom range with `to < from` is rejected by the picker.
- Custom range longer than 365 days is rejected by the picker; the calendar disables dates that would push the selection past the cap, and the picker surfaces a §10-voice hint ("max window is a year. anything longer is just a heatmap.").
- Windows shorter than 7 days suppress the Weekly Coding Days histogram and show a single last-week summary instead.
- There is no "all-time" option — the 365-day cap is the ceiling. Users who want the year-at-a-glance view already have the Consistency Map.
- Cache keys for TanStack Query and worker memoization include the resolved `{from, to}` ISO pair, so switching timeframes is a fast cache lookup, not a recompute, on repeat selections.
