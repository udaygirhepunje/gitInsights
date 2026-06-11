import { Code, List, Stack } from '@mantine/core';
import type { ReactNode } from 'react';

type HelpEntry = { bullets: readonly string[]; formula?: string };

function HelpBody({ bullets, formula }: HelpEntry): JSX.Element {
  return (
    <Stack gap="sm">
      <List size="sm" spacing={4} withPadding>
        {bullets.map((line, i) => (
          <List.Item key={i}>{line}</List.Item>
        ))}
      </List>
      {formula ? (
        <Code block fz={11} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {formula}
        </Code>
      ) : null}
    </Stack>
  );
}

export const TILE_HELP = {
  // Score is derived from a non-obvious recency-weight curve; without the
  // formula "236 pts" reads as a magic number.
  commitMomentum: (
    <HelpBody
      bullets={[
        'rolling score for your last year of commits',
        'recent days lift it more; older days still nudge it, just lighter',
        'not about lines changed or how busy you look to anyone else',
      ]}
      formula={`CommitMomentum = Σ RecencyWeight (one term per commit in window)
if ageDays > 365:   RecencyWeight = 0
else:   RecencyWeight = max(0.25, min(1, 1 − 0.75 * ageDays / 365))
ageDays = whole days from commit time to now`}
    />
  ),

  streak: (
    <HelpBody
      bullets={[
        'how many days in a row you actually coded',
        'weekends and time off can sit outside the count — your call in settings',
        'tweak the mode if your life doesn’t match the default',
      ]}
      formula={`longest = max run of streak-eligible days with ≥1 commit in the window`}
    />
  ),

  // Bullets already cover numerator / denominator + intent. Formula skipped.
  weeklyCodingDays: (
    <HelpBody
      bullets={[
        'avg coding days / avg Effective Working Days per week, across the selected window',
        'Effective Working Days = configured workdays minus PTO and public holidays',
        'bars group by week, pair, or month depending on window size; hover each for the breakdown',
      ]}
    />
  ),

  averageCommitsPerDay: (
    <HelpBody
      bullets={[
        'authored non-merge commits divided by Effective Working Days in the selected window',
        'commits on off-days still count in the numerator; off-days only affect the denominator',
        'if Effective Working Days is 0, this reads as a rest window instead of a fake zero',
      ]}
      formula={`AverageCommitsPerDay = totalAuthoredNonMergeCommits / effectiveWorkingDays`}
    />
  ),

  mergedPrsAuthored: (
    <HelpBody
      bullets={[
        'counts only pull requests you authored and that were merged in the selected window',
        'co-authored attribution is intentionally excluded in v1',
        'includes public + accessible private repos with your current github scopes',
      ]}
      formula={`MergedPRsAuthored(from,to) = count(PR where
author.login = viewer.login
AND mergedAt ∈ [from,to])`}
    />
  ),

  // Self-evident from the grid itself — color depth = activity. No formula.
  consistencyMap: (
    <HelpBody
      bullets={[
        'your last year as a grid of days',
        'deeper color = more commits that day; light = quiet',
        'pto and holidays read as their own color so rest shows up',
      ]}
    />
  ),

  // Audit metric: thresholds are not obvious (22:00–05:59 = late night, what
  // counts as "evaluable", how breaks are computed). Formula stays.
  wlbAudit: (
    <HelpBody
      bullets={[
        'when you commit: late nights vs workdays vs the rest',
        'one weird week doesn’t get to rewrite your whole story',
        'footers say it plain — no lecture, no shame',
      ]}
      formula={`- LateNightRatio = commits 22:00–05:59 local time / evaluableCommits
- NonWorkdayRatio = commits on your non-workdays / evaluableCommits
- evaluableCommits = commits not on PTO or public holiday (for those ratios)
- HourHistogram[h] = commits whose local hour is h
- longestBreakDays = longest run of non-off-days in a row with zero commits`}
    />
  ),

  // "Vibe check, not a ranking" is enough — bytes-weighting is plumbing.
  techStack: (
    <HelpBody
      bullets={[
        'what your repos lean toward lately, language-wise',
        'a vibe check, not a ranking',
        'moves when your work moves — that’s normal',
      ]}
    />
  ),
} satisfies Record<string, ReactNode>;

export type TileHelpKey = keyof typeof TILE_HELP;
