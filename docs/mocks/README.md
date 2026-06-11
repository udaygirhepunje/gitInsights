# mocks

Static, single-file design board for gitInsights. Open `index.html` in any
browser — no build, no deps. Treat it like a Figma file: every screen on one
infinite canvas, with frame labels and route annotations.

## What's in here

`index.html` renders all the screens described in `docs/spec.md` §4:

1. **Landing / `/`** — dark + light, with scope disclosure card and OAuth CTA.
1. **OAuth callback / `/callback`** — loading spinner + proxy-error state.
1. **Dashboard / `/dashboard`** — full bento grid (dark + light):
   - Commit Momentum (365d) with sparkline + verdict.
   - Streak tile (uses `weekends don't break me` mode).
   - Weekly Coding Days with PTO-aware denominator.
   - Consistency Map (53-week heatmap) with PTO, public holiday, and
     PTO-violation rendering.
   - Merged PRs (Authored) — authored + merged only in the selected timeframe.
   - Average Commits / Day — authored non-merge commits per effective working day, with a compact line-chart trend.
   - WLB Audit (24-hr histogram + PTO-honored / violation stats + verdict).
   - Tech Stack (top languages by bytes).
   - Upcoming PTO mini-month.
1. **Dashboard states** — loading skeleton, 403 rate-limit banner with cached
   tiles, empty state for new accounts.
1. **Mobile (360w)** — landing, dashboard (single-column bento), settings.
1. **Settings / `/settings`** — theme, workweek picker, streak mode radios,
   public holidays region multi-select with "i worked" overrides, full PTO
   month-picker with range selection + PTO list, and a separate frame for the
   gist-sync opt-in dialog and enabled-sync state with `delete cloud copy`.
1. **Public profile / `/u/:username`** — read-only showoff page.
1. **404 + auth-expired toast.**

## Design tokens

Approximated from Primer's dark and light palettes (`--canvas`, `--fg`,
`--accent`, `--success`, `--danger`, `--hm-0..4`, `--hm-pto`,
`--hm-violation`). Dark is the default; the light theme renders by adding a
`.light` class to the `.frame`. No hard-coded colors inside components — only
tokens.

## Voice

Every visible string is written in the §10 brutalist voice (lowercase OK,
short, anti-grind, no moralizing). Examples in the file:

- WLB verdict: _"11 nights past 22:00 last month. that's a lot. log off."_
- Empty state: _"nothing here yet. either you're new, on PTO, or actually
  resting. all valid."_
- 404: _"this route doesn't exist. neither does the work you didn't do today.
  that's fine."_
- Sync opt-in: includes the explicit disclosure that `gist` covers _all_ gists.

## What this is not

- Not a React app, not the real implementation. Pure HTML/CSS + ~50 lines of
  JS to procedurally generate the heatmap, mobile heatmap, and WLB histogram.
- Not pixel-locked to Primer; it's "Primer-flavored" so it reads as
  GitHub-native without pulling the real Primer CSS.
- Not exhaustive. Bento layout, achievements page, and the public profile are
  intentionally lightweight pending the spec's open questions (§11).
