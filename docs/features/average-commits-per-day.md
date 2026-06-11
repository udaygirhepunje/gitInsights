# Feature — Average Commits / Day

Dashboard tile that reports average authored non-merge commits per effective working day over the resolved global timeframe, with a compact line-chart trend for the same window. It shares denominator semantics with Weekly Coding Days so both tiles tell a consistent story.

**Spec refs**: `docs/spec.md §6 Data Model & Metric Definitions`, [`weekly-coding-days.md`](./weekly-coding-days.md), [`global-timeframe.md`](./global-timeframe.md), `docs/spec.md §3.D.1 Incremental Commit Cache`.
**Implementation plan**: [`docs/tasks/archive/phase-14-average-commits-per-day-widget.md`](../tasks/archive/phase-14-average-commits-per-day-widget.md).

## Definition

- `AverageCommitsPerDay(from, to) = totalAuthoredNonMergeCommits(from, to) / effectiveWorkingDays(from, to)`.
- Numerator: authored non-merge commits in the resolved `{from, to}` window (same commit source used by commit-based analytics).
- Denominator: `effectiveWorkingDays` from Weekly Coding Days semantics (workweek + PTO + public holidays + overrides).
- Commits made on off-days are still part of the numerator; off-day logic affects the denominator only.

## Timeframe and zero-denominator behavior

- Always computed from the resolved global timeframe window (same picker as other timeframe-aware dashboard widgets).
- If `effectiveWorkingDays` is `0`, render a rest/off-day state instead of showing `0` as a productivity signal.

## Data source, visibility, and caching

- Reuses incremental commit cache month chunks (`gi.commits.<login>.<YYYY-MM>`) rather than introducing a second commit fetch path.
- Cache and query keys include resolved `{from, to}` so timeframe changes remain deterministic and cache-friendly.
- Visibility matches existing commit-based metrics: data includes repos accessible to the authenticated user in the current session.
