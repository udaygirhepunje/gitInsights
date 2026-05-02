# gitInsights — Tasks

Implementation tasks broken out per feature / build phase. Each file has a goal, the spec sections (and feature files) it implements, dependencies on prior phases, the screens / components it touches, an acceptance checklist, and a concrete task list. Source of truth for product behavior is always [`../spec.md`](../spec.md) plus the relevant [`../features/*.md`](../features/) file; these task files describe **how** to build it, not **what** it should do.

## Folders

```
docs/tasks/
├── README.md      ← this file
├── backlog/       ← tasks queued up but not yet done
└── archive/       ← tasks fully shipped (kept for history)
```

### Workflow

- **New tasks land in [`backlog/`](./backlog/).** Every new feature gets a `phase-NN-<slug>.md` file in `backlog/` before any code is written.
- **As work progresses, tick checkboxes in the file in place.** The file stays in `backlog/` while it's the active piece of work.
- **When a phase is fully shipped, move the file to [`archive/`](./archive/) verbatim.** Don't rewrite the history; the archived file is the record of what was actually built and why.
- Every PR should reference the active task file (e.g. `docs/tasks/backlog/phase-09-global-timeframe-filter.md`) and the spec / feature section(s) it implements.

## Phases

### Backlog

| # | File | Goal |
|---|---|---|
| 9 | [`backlog/phase-09-global-timeframe-filter.md`](./backlog/phase-09-global-timeframe-filter.md) | Dashboard-wide timeframe picker (presets / month / quarter / custom, 365d cap) + Weekly Coding Days bucketed histogram. Implements [`../features/global-timeframe.md`](../features/global-timeframe.md). |
| 11 | [`backlog/phase-11-incremental-commit-cache.md`](./backlog/phase-11-incremental-commit-cache.md) | Month-chunked commit cache, progressive background backfill, search-request throttle, `Retry-After` handling. Eliminates secondary rate-limit `403`s on first/cold loads. Implements `spec.md §3.D.1`. |

### Archive (shipped)

| # | File | Goal |
|---|---|---|
| 0 | [`archive/phase-00-tooling.md`](./archive/phase-00-tooling.md) | Project conventions, lint, test, Node pin |
| 1 | [`archive/phase-01-scaffolding-and-theming.md`](./archive/phase-01-scaffolding-and-theming.md) | Vite + Router + Mantine + Primer→Mantine theme + dark/light/system |
| 2 | [`archive/phase-02-auth-and-proxy.md`](./archive/phase-02-auth-and-proxy.md) | OAuth flow, Vercel token proxy, `useAuth` |
| 3 | [`archive/phase-03-github-data-layer.md`](./archive/phase-03-github-data-layer.md) | Octokit + TanStack Query + IndexedDB cache + `viewerCommitsByDay` |
| 4 | [`archive/phase-04-bento-and-heatmap.md`](./archive/phase-04-bento-and-heatmap.md) | Bento grid + Consistency Map (custom CSS-grid; commits-only data source) |
| 5 | [`archive/phase-05-analytics-wlb-pto-holidays.md`](./archive/phase-05-analytics-wlb-pto-holidays.md) | Commit Momentum, WLB, Weekly Coding Days, Workweek, PTO, Public Holidays, `gi.user-data` store |
| 5b | [`archive/phase-05b-cross-device-sync.md`](./archive/phase-05b-cross-device-sync.md) | Opt-in private-Gist sync of `gi.user-data` |
| 6 | [`archive/phase-06-deployment.md`](./archive/phase-06-deployment.md) | GitHub Pages SPA hack + Vercel deploy |
| 7 | [`archive/phase-07-cicd-quality.md`](./archive/phase-07-cicd-quality.md) | GitHub Actions CI, build, deploy, Lighthouse |
| 8 | [`archive/phase-08-polish-and-launch.md`](./archive/phase-08-polish-and-launch.md) | 404, OG image, README, privacy page |
| 10 | [`archive/phase-10-cross-tile-heatmap-highlights.md`](./archive/phase-10-cross-tile-heatmap-highlights.md) | Cross-tile heatmap hover highlights + Weekly Coding Days semantics cleanup |

## Screen → Phase matrix

Where each screen from `spec.md §4` actually gets built.

| Screen | First appears in | Final shape lands in |
|---|---|---|
| `/` Landing / Login | Phase 1 (shell) | Phase 2 (login button + scope disclosure) |
| `/callback` OAuth Callback | Phase 2 | Phase 2 |
| `/dashboard` (Bento) | Phase 4 (layout + Consistency Map) | Phase 5 (Commit Momentum, Weekly Coding Days, WLB, Tech Stack, PTO/holiday rendering) → Phase 9 (Global Timeframe Filter) |
| `/u/:username` Public Profile | _deferred — TBD per spec §4.D / §11_ | _deferred_ |
| `/settings` | Phase 1 (theme picker) | Phase 5 (workweek, streak mode, PTO calendar, holidays) → Phase 5b (sync controls) |
| `*` 404 (in-app) | Phase 1 (route exists) | Phase 8 (branded copy) |

## Cross-cutting concerns (apply to every phase)

- **Voice & copy**: every user-facing string follows `spec.md §10`. No "Oops!", no generic "An error occurred." See the Don't / Do examples there.
- **A11y**: WCAG 2.1 AA, keyboard nav, focus rings, color is never the only signal.
- **Component policy**: every UI element is a Mantine primitive or a `styled(MantineComponent)` extension. No raw HTML components — `styled.div` / `styled.span` / `styled.button` etc. are not allowed (lint enforced). See `spec.md §4 Cross-cutting UI Requirements`.
- **No hard-coded colors**: every surface (Mantine + Styled Components, including the Consistency Map and Recharts) resolves through the shared Mantine theme that's mapped from `@primer/primitives`.
- **No third-party runtime calls**: only `api.github.com` and the Vercel token proxy. Bundled assets only for things like the holidays dataset.
- **TypeScript strict**: every PR typechecks clean.
- **Cache invalidation**: any worker-memoized result must include the relevant settings version (PTO, holidays, workweek, timeframe) in its key.

## Out of scope for v1 (see `spec.md §11`)

- Public profile model (`/u/:username`).
- GitHub App migration.
- Custom `.ics` import for holidays.
- Achievements / badges page.
