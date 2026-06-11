# Phase 13 — Merged PRs (Authored) Widget

**Goal**: ship a dashboard widget that counts pull requests authored by the signed-in user and merged in the currently selected Global Timeframe window.

**Spec refs**: `spec.md §3.D.2 Incremental PR merge cache`, `spec.md §3.H Error Handling` (SSO caveat), `spec.md §6 Metrics` (Merged PRs + Global Timeframe).

**Depends on**: Phase 9 (global timeframe), Phase 11 (incremental cache pattern and month-chunk behavior).

**Screens touched**: `/dashboard`.

---

## Objective

Ship a dashboard widget that counts pull requests authored by the signed-in user and merged in the currently selected Global Timeframe window.

## Scope

- Add a new `/dashboard` widget for merged PR count using the same global timeframe control used by existing timeframe-aware widgets.
- Count only PRs where the viewer is the PR author and `mergedAt` falls inside the resolved timeframe.
- Include data from public + private repos accessible with existing OAuth scopes (`repo`, `read:org`).
- Explicitly exclude co-authored PR attribution in this phase.

## Implementation notes

- Data query should enforce authored-only semantics (for example, GitHub search with `type:pr author:{login} is:merged merged:{from}..{to}`), then normalize to a stable PR event shape.
- Use incremental month-chunk storage in IndexedDB (`gi.prs.<login>.<YYYY-MM>`) modeled after commit caching:
  - fetch only missing months for the selected window,
  - fetch only missing/new entries for the active month,
  - merge + dedupe by PR id when persisting.
- TanStack Query keys must include resolved timeframe bounds so repeated window switches hit cache.
- If org SSO blocks private-org data, keep partial counts and rely on the existing SSO-required banner/error flow (no custom auth flow in this phase).

## Acceptance criteria

- [x] Widget count updates when Global Timeframe changes and matches authored+merged PRs for the resolved `{from,to}`.
- [x] Co-authored PRs are not counted, and this exclusion is documented in code comments/docs where the filter is applied.
- [x] Cached month chunks are reused across timeframe switches; only missing/new data is fetched.
- [x] Public and accessible private repos are included; SSO-gated repos remain excluded until user re-authorizes org access.
- [x] Empty/loading/error states follow existing tile patterns and spec voice rules.
