import { Box, Group, Stack, Text, Tooltip, type TooltipProps } from '@mantine/core';
import { LineChart } from '@mantine/charts';
import { GitPullRequestIcon } from '@primer/octicons-react';
import { useEffect, useMemo } from 'react';
import styled from 'styled-components';

import { formatDisplayDayMonth, startOfDay, sundayWeekKey, sundayWeekRange, toIsoDateKey } from '../../../analytics/dates';
import { isOffDay, type OffDayContext } from '../../../analytics/offDay';
import { useAuth } from '../../../hooks/useAuth';
import { useViewerMergedPrsAuthored } from '../../../hooks/useGitHubQueries';
import { useTimeframe } from '../../../hooks/useTimeframe';
import { useHoverHighlight } from '../../../store/hoverHighlight';
import { useOffDayContext } from '../../../userData/useOffDayContext';
import { BENTO_AREAS, BentoTile, TILE_HELP } from '..';
import { StatNumber, VerdictLine } from './Stat';

const SPARKLINE_H = 72;

const ChartWrap = styled(Box)`
  position: relative;
  min-width: 0;
  width: 100%;
  height: ${SPARKLINE_H}px;
  overflow: hidden;
` as typeof Box;

const ChartHoverLayer = styled(Box)`
  position: absolute;
  inset: 0;
  display: flex;
  z-index: 2;
` as typeof Box;

const ChartHoverSlice = styled(Box)`
  flex: 1 1 0;
  min-width: 0;
  outline: none;
` as typeof Box;

type MergedPrTrendPoint = {
  label: string;
  from: string;
  to: string;
  mergedPrs: number;
  highlightDates: string[];
};

function buildMergedPrTrend(args: {
  byDate: Record<string, number>;
  from: Date;
  to: Date;
  ctx: OffDayContext;
  granularity: 'daily' | 'weekly';
}): MergedPrTrendPoint[] {
  const rangeFrom = startOfDay(args.from);
  const rangeTo = startOfDay(args.to);

  if (args.granularity === 'daily') {
    const points: MergedPrTrendPoint[] = [];
    const cursor = new Date(rangeFrom);
    while (cursor <= rangeTo) {
      const day = toIsoDateKey(cursor);
      points.push({
        label: formatDisplayDayMonth(day),
        from: day,
        to: day,
        mergedPrs: args.byDate[day] ?? 0,
        highlightDates: isOffDay(day, args.ctx) ? [] : [day],
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return points;
  }

  const weekly = new Map<string, MergedPrTrendPoint>();
  const cursor = new Date(rangeFrom);
  while (cursor <= rangeTo) {
    const day = toIsoDateKey(cursor);
    const weekKey = sundayWeekKey(cursor);
    const bucket = weekly.get(weekKey);
    if (!bucket) {
      const wr = sundayWeekRange(cursor);
      const clippedFrom = wr.from > rangeFrom ? wr.from : rangeFrom;
      const clippedTo = wr.to < rangeTo ? wr.to : rangeTo;
      weekly.set(weekKey, {
        label: `w${weekKey.split('-W')[1] ?? '??'}`,
        from: toIsoDateKey(clippedFrom),
        to: toIsoDateKey(clippedTo),
        mergedPrs: args.byDate[day] ?? 0,
        highlightDates: isOffDay(day, args.ctx) ? [] : [day],
      });
    } else {
      bucket.mergedPrs += args.byDate[day] ?? 0;
      if (!isOffDay(day, args.ctx)) {
        bucket.highlightDates.push(day);
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return [...weekly.values()].sort((a, b) => (a.from < b.from ? -1 : 1));
}

function TooltipRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <Group justify="space-between" gap="lg" wrap="nowrap">
      <Text component="span" size="xs" ff="monospace" c="dimmed">
        {label}
      </Text>
      <Text component="span" size="xs" ff="monospace" fw={600}>
        {value}
      </Text>
    </Group>
  );
}

function pointTooltipLabel(point: MergedPrTrendPoint): TooltipProps['label'] {
  const isSingleDayPoint = point.from === point.to;
  const rangeValue =
    point.from === point.to
      ? formatDisplayDayMonth(point.from)
      : `${formatDisplayDayMonth(point.from)} – ${formatDisplayDayMonth(point.to)}`;
  return (
    <Stack gap={4} p={2}>
      <Text size="xs" ff="monospace" fw={600}>
        {point.label}
      </Text>
      {isSingleDayPoint ? null : <TooltipRow label="range" value={rangeValue} />}
      <TooltipRow label="merged PRs" value={String(point.mergedPrs)} />
    </Stack>
  );
}

function pointAriaLabel(point: MergedPrTrendPoint): string {
  if (point.from === point.to) return `${point.label}. ${point.mergedPrs} merged PRs.`;
  return `${point.label}. ${point.mergedPrs} merged PRs from ${point.from} to ${point.to}.`;
}

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
  const { from, to, label, timeframe } = useTimeframe();
  const { setRange, clear } = useHoverHighlight();
  const { ctx } = useOffDayContext();

  useEffect(() => clear, [clear]);

  const { data, isLoading, isError, refetch } = useViewerMergedPrsAuthored({
    login: viewer?.login,
    range: { from, to },
  });

  const trendPoints = useMemo(
    () =>
      data
        ? buildMergedPrTrend({
            byDate: data.byDate,
            from,
            to,
            ctx,
            granularity:
              timeframe.kind === 'preset' && timeframe.preset === 'last-week'
                ? 'daily'
                : 'weekly',
          })
        : [],
    [ctx, data, from, timeframe, to],
  );

  const chartData = useMemo(
    () => trendPoints.map((point) => ({ label: point.label, mergedPrs: point.mergedPrs })),
    [trendPoints],
  );

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
          {trendPoints.length > 0 ? (
            <ChartWrap>
              <LineChart
                h={SPARKLINE_H}
                data={chartData}
                dataKey="label"
                series={[{ name: 'mergedPrs', color: 'primerPurple.5' }]}
                curveType="monotone"
                withDots
                withTooltip={false}
                withXAxis={false}
                withYAxis={false}
                gridAxis="none"
                style={{ padding: 5 }}
              />
              <ChartHoverLayer onMouseLeave={clear}>
                {trendPoints.map((point) => (
                  <Tooltip
                    key={`${point.from}-${point.to}`}
                    label={pointTooltipLabel(point)}
                    withArrow
                    position="top"
                    withinPortal
                    fz={10}
                  >
                    <ChartHoverSlice
                      onMouseEnter={() =>
                        setRange({ from: point.from, to: point.to, dates: point.highlightDates })
                      }
                      onFocus={() =>
                        setRange({ from: point.from, to: point.to, dates: point.highlightDates })
                      }
                      onBlur={clear}
                      tabIndex={0}
                      aria-label={pointAriaLabel(point)}
                    />
                  </Tooltip>
                ))}
              </ChartHoverLayer>
            </ChartWrap>
          ) : null}
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
