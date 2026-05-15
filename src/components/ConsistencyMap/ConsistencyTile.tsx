import { Group, Stack, Text } from '@mantine/core';
import { CalendarIcon } from '@primer/octicons-react';
import { useCallback, useMemo, useState } from 'react';

import { useAuth } from '../../hooks/useAuth';
import { useViewerCommitsByDay } from '../../hooks/useGitHubQueries';
import { useCellAdornments } from '../../hooks/useCellAdornments';
import { BENTO_AREAS, BentoTile, TILE_HELP } from '../Bento';
import { metricMonoStyle } from '../Bento/tiles/metricMonoStyle';
import { ConsistencyMap } from './ConsistencyMap';
import { DayCommitsModal } from './DayCommitsModal';
import { HeatmapA11yTable } from './HeatmapA11yTable';
import { commitsToHeatmapRows, rollingYearWindow } from './contributions';
import { HeatmapLegend } from './HeatmapLegend';

// Heatmap shows pure non-merge commits per day (REST search/commits with
// `merge:false`), not the GitHub "contributions" total which folds in PRs /
// issues / reviews / comments / approvals. The 4-state surface is owned by
// `BentoTile`. Phase 5 wires `cellAdornments` to render PTO + Public Holiday
// cells in the off-day color, with a violation dot overlay when a commit
// landed on an off-day.
//
// Phase 9 carve-out (spec §6 Consistency): this tile intentionally does NOT
// read from `useTimeframe()`. The heatmap is always the trailing 53 weeks —
// that's the whole point of a heatmap. Streak counters follow the same fixed
// window. Do not wire this to the global timeframe filter.

export function ConsistencyTile(): JSX.Element {
  const { viewer } = useAuth();
  const [dayModalDateKey, setDayModalDateKey] = useState<string | null>(null);
  const handleDayActivate = useCallback((dateKey: string) => {
    setDayModalDateKey(dateKey);
  }, []);
  const window = useMemo(() => rollingYearWindow(), []);
  const { data, isLoading, isError, isPlaceholderData, isFetching, refetch } =
    useViewerCommitsByDay({
      login: viewer?.login,
      range: window,
    });

  const rows = useMemo(
    () => (data ? commitsToHeatmapRows(data.byDate, window, data.coverage) : []),
    [data, window],
  );
  const byDateMap = useMemo(() => {
    const m = new Map<string, number>();
    if (data) for (const [k, v] of Object.entries(data.byDate)) m.set(k, v);
    return m;
  }, [data]);
  const cellAdornments = useCellAdornments(byDateMap);
  const totalCommits = data?.totalCommits ?? 0;
  const dayModalExpectedCount =
    dayModalDateKey != null ? (byDateMap.get(dayModalDateKey) ?? 0) : 0;

  // Spec §3.D: when a 403/rate-limit hits but we already have a persisted
  // snapshot, keep showing it. The global RateLimitBanner signals staleness.
  // Only collapse to the error tile when there is literally nothing to render.
  let state: 'loading' | 'empty' | 'error' | 'loaded' = 'loading';
  if (data && totalCommits === 0) state = 'empty';
  else if (data) state = 'loaded';
  else if (isError) state = 'error';
  else if (isLoading) state = 'loading';

  return (
    <BentoTile
      title="your year. one square per day."
      titleTooltip={TILE_HELP.consistencyMap}
      icon={CalendarIcon}
      state={state}
      area={BENTO_AREAS.Consistency}
      onRetry={() => void refetch()}
      emptyMessage="no commits in the last 365 days. either you’re new, on PTO, or actually resting. all valid."
      errorMessage="couldn’t load your commits. github blinked. try again."
      footer={
        state === 'loaded' ? (
          <Group justify="space-between">
            <Text size="xs" c="dimmed" style={metricMonoStyle}>
              {totalCommits.toLocaleString()} commits, last 365 days.
              {data?.coverage?.backfilling
                ? ' loading older months…'
                : isPlaceholderData && isFetching
                  ? ' refreshing…'
                  : ''}
            </Text>
            <HeatmapLegend />
          </Group>
        ) : null
      }
    >
      <Stack gap="xs">
        <DayCommitsModal
          opened={dayModalDateKey != null}
          dateKey={dayModalDateKey}
          login={viewer?.login}
          onClose={() => setDayModalDateKey(null)}
          expectedCount={dayModalExpectedCount}
        />
        <ConsistencyMap
          rows={rows}
          window={window}
          cellAdornments={cellAdornments}
          onDayActivate={handleDayActivate}
        />
        <HeatmapA11yTable
          rows={rows}
          adornments={cellAdornments}
          caption="commits over the last 365 days"
        />
      </Stack>
    </BentoTile>
  );
}
