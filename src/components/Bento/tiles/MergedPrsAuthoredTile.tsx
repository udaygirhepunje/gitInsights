import { Stack, Text } from '@mantine/core';
import { GitPullRequestIcon } from '@primer/octicons-react';

import { useAuth } from '../../../hooks/useAuth';
import { useViewerMergedPrsAuthored } from '../../../hooks/useGitHubQueries';
import { useTimeframe } from '../../../hooks/useTimeframe';
import { BENTO_AREAS, BentoTile, TILE_HELP } from '..';
import { StatNumber, VerdictLine } from './Stat';

function mergedPrVerdict(total: number, exact: boolean, label: string): string {
  if (!exact) {
    return `showing a partial count for ${label}. narrow the timeframe (for example, this month or this week) to get an exact total.`;
  }
  if (total === 0) return `no authored PRs merged in ${label}. could be review-heavy weeks or real rest.`;
  if (total < 5) return 'quiet merge lane, but meaningful progress is still landing.';
  if (total < 15) return 'strong delivery rhythm. steady momentum across this window.';
  return 'surge mode. high merge momentum and strong execution.';
}

export function MergedPrsAuthoredTile(): JSX.Element {
  const { viewer } = useAuth();
  const { from, to, label } = useTimeframe();
  const { data, isLoading, isError, refetch } = useViewerMergedPrsAuthored({
    login: viewer?.login,
    range: { from, to },
  });

  let state: 'loading' | 'empty' | 'error' | 'loaded' = 'loading';
  if (data && data.total === 0) state = 'empty';
  else if (data) state = 'loaded';
  else if (isError) state = 'error';
  else if (isLoading) state = 'loading';

  return (
    <BentoTile
      title={`merged prs authored · ${label}`}
      titleTooltip={TILE_HELP.mergedPrsAuthored}
      icon={GitPullRequestIcon}
      state={state}
      area={BENTO_AREAS.MergedPrsAuthored}
      onRetry={() => void refetch()}
      emptyMessage="no authored PRs merged in this window. could be review season, could be actual rest."
      footer={state === 'loaded' && data ? <VerdictLine>{mergedPrVerdict(data.total, data.exact, label)}</VerdictLine> : null}
    >
      {data ? (
        <Stack gap="sm">
          <StatNumber value={data.total.toLocaleString()} unit="merged PRs" hero />
          <Text size="xs" c="dimmed">
            authored by you, merged inside the selected timeframe.
          </Text>
          {!data.exact ? (
            <Text size="xs" c="yellow" ff="monospace">
              count is partial because github search capped at least one day. to get an exact count, narrow the
              timeframe and retry.
            </Text>
          ) : null}
        </Stack>
      ) : null}
    </BentoTile>
  );
}
