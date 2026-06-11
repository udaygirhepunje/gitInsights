# Phase 14 — Average Commits / Day Widget

**Goal**: ship a dashboard widget that reports average authored non-merge commits per effective working day for the currently selected Global Timeframe.

**Spec refs**: `spec.md §6 Metrics` (Average Commits / Day + Global Timeframe), `features/weekly-coding-days.md` (effective working days semantics), `spec.md §3.D.1 Incremental Commit Cache`.

**Depends on**: Phase 5 (Weekly Coding Days + off-day primitives), Phase 9 (global timeframe wiring), Phase 11 (incremental commit cache).

**Screens touched**: `/dashboard`.

---

## Objective

Ship a dashboard widget that reports average authored non-merge commits per effective working day for the currently selected Global Timeframe.

## Scope

- Add a new `/dashboard` widget that uses the same global timeframe control as existing timeframe-aware tiles.
- Numerator: total authored non-merge commits in the resolved timeframe.
- Denominator: `effectiveWorkingDays` using the same workweek/PTO/public-holiday/override behavior as Weekly Coding Days.
- Visual trend: compact line chart (not bars) aligned to the resolved timeframe window.
- Render an explicit rest/off-day state when denominator is `0` (no misleading zero-value productivity framing).

## Implementation notes

- Reuse the existing commit-by-day data path (incremental commit cache + merged chunks) instead of introducing a second commit source.
- Reuse or extract shared denominator helpers from Weekly Coding Days to guarantee identical `effectiveWorkingDays` behavior.
- Include resolved timeframe bounds in query/memo keys so timeframe switches are deterministic and cache-friendly.
- Keep tile copy aligned with spec voice guidance and avoid manager-style framing.

## Acceptance criteria

- [x] Widget recomputes from the resolved Global Timeframe and stays in sync with timeframe changes.
- [x] Denominator exactly matches Weekly Coding Days semantics for every date classification edge case.
- [x] When denominator is `0`, widget shows rest/off-day messaging instead of `0` as a performance signal.
- [x] Numerator comes from authored non-merge commits already used by commit-based analytics, with no duplicate fetch path.
- [x] Loading/empty/error states match established dashboard tile patterns.
