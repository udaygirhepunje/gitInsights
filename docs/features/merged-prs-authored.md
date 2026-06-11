# Feature — Merged PRs (Authored)

Dashboard tile that counts pull requests authored by the signed-in user and merged inside the resolved global timeframe window. This metric is intentionally strict: authored + merged only.

**Spec refs**: `docs/spec.md §3.D.2 Incremental PR merge cache`, `docs/spec.md §3.H Error Handling` (SSO caveat), `docs/spec.md §6 Data Model & Metric Definitions`.
**Implementation plan**: [`docs/tasks/archive/phase-13-merged-prs-widget.md`](../tasks/archive/phase-13-merged-prs-widget.md).

## Definition

- `MergedPRsAuthored(from, to)` = count of PRs where:
  - `author.login === viewer.login`
  - PR is merged (`is:merged` / `mergedAt != null`)
  - `mergedAt` is inside resolved `{from, to}` from [`global-timeframe.md`](./global-timeframe.md)
- v1 explicitly excludes co-authored PR attribution. If the viewer is not the PR author, it does not count.

## Data source and query semantics

- Source is GitHub issue search for PRs, with authored + merged filters (for example: `type:pr author:{login} is:merged merged:{from}..{to}`).
- Results are normalized to a stable PR event shape and deduped by PR id before metric aggregation.

## Visibility scope

- Coverage includes public repositories plus private repositories visible with existing OAuth scopes (`repo`, `read:org`).
- Org SSO restrictions can still hide private-org PRs until re-authorization; the widget should preserve partial counts rather than failing the full metric.

## Caching and timeframe behavior

- Uses incremental month-chunk storage in IndexedDB: `gi.prs.<login>.<YYYY-MM>`.
- For historical months, fetch only missing month chunks; for the active month, fetch only missing/new merged PRs.
- Cache writes merge and dedupe by PR id; repeated timeframe switches should primarily hit local cache.
- Query and memo keys include resolved `{from, to}` to keep timeframe transitions deterministic.
