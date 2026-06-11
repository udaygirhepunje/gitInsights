import { Box, Group, Stack, Text, Tooltip, type TooltipProps } from '@mantine/core';
import { LineChart } from '@mantine/charts';
import { GraphIcon } from '@primer/octicons-react';
import { useEffect, useMemo } from 'react';
import styled from 'styled-components';

import {
  buildAverageCommitsTrend,
  countEffectiveWorkingDays,
  summarizeAverageCommitsPerDay,
  type AverageCommitsTrendPoint,
} from '../../../analytics/averageCommitsPerDay';
import { formatDisplayDayMonth } from '../../../analytics/dates';
import { useAuth } from '../../../hooks/useAuth';
import { useViewerCommitsByDay } from '../../../hooks/useGitHubQueries';
import { useTimeframe } from '../../../hooks/useTimeframe';
import { useHoverHighlight } from '../../../store/hoverHighlight';
import { useOffDayContext } from '../../../userData/useOffDayContext';
import { BENTO_AREAS, BentoTile, TILE_HELP } from '..';
import { StatNumber, StatRow, VerdictLine } from './Stat';
import { resolveAverageCommitsPerDayTileState } from './averageCommitsPerDayModel';

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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatAverage(n: number | null): string {
  if (n === null) return '—';
  return round2(n).toFixed(2);
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

function formatTooltipRange(from: string, to: string): string {
  if (from === to) return formatDisplayDayMonth(from);
  return `${formatDisplayDayMonth(from)} – ${formatDisplayDayMonth(to)}`;
}

function pointTooltipLabel(point: AverageCommitsTrendPoint): TooltipProps['label'] {
  const isSingleDayPoint = point.from === point.to;

  if (point.isRest) {
    return (
      <Stack gap={4} p={2}>
        <Text size="xs" ff="monospace" fw={600}>
          {point.label}
        </Text>
        <TooltipRow label="range" value={formatTooltipRange(point.from, point.to)} />
        <TooltipRow label="commits" value={String(point.commits)} />
        <Text size="xs" ff="monospace" c="dimmed">
          off-days only (effective working days: 0)
        </Text>
      </Stack>
    );
  }

  if (isSingleDayPoint) {
    return (
      <Stack gap={4} p={2}>
        <Text size="xs" ff="monospace" fw={600}>
          {point.label}
        </Text>
        <TooltipRow label="commits" value={String(point.commits)} />
      </Stack>
    );
  }

  return (
    <Stack gap={4} p={2}>
      <Text size="xs" ff="monospace" fw={600}>
        {point.label}
      </Text>
      <TooltipRow label="range" value={formatTooltipRange(point.from, point.to)} />
      <TooltipRow label="avg commits/effective day" value={formatAverage(point.average)} />
      <TooltipRow label="commits" value={String(point.commits)} />
      <TooltipRow label="effective working days" value={String(point.effectiveWorkingDays)} />
    </Stack>
  );
}

function pointAriaLabel(point: AverageCommitsTrendPoint): string {
  const isSingleDayPoint = point.from === point.to;

  if (point.isRest) {
    return `${point.label}. off-days only. ${point.commits} commits.`;
  }
  if (isSingleDayPoint) {
    return `${point.label}. date ${point.from}. ${point.commits} commits.`;
  }
  return `${point.label}. average ${formatAverage(point.average)} commits per effective day. ${point.commits} commits over ${point.effectiveWorkingDays} effective working days.`;
}

function averageVerdict(args: {
  average: number | null;
  totalCommits: number;
  effectiveWorkingDays: number;
}): string {
  if (args.effectiveWorkingDays === 0) {
    if (args.totalCommits > 0) return `${args.totalCommits} commits landed on off-days. denominator stays at 0 by design.`;
    return 'all selected days were off-days. this window is rest by definition.';
  }
  if (args.totalCommits === 0) return 'no commits in the selected window.';
  if (args.average !== null && args.average >= 3) return 'high shipping cadence in this window.';
  if (args.average !== null && args.average >= 1.5) return 'steady pace across effective working days.';
  if (args.average !== null && args.average >= 0.75) return 'lighter pace, still active in the window.';
  return 'quiet window. could be deep work, recovery, or both.';
}

export function AverageCommitsPerDayTile(): JSX.Element {
  const { viewer } = useAuth();
  const { from, to, timeframe } = useTimeframe();
  const { setRange, clear } = useHoverHighlight();
  const { ctx, isLoading: offDayLoading } = useOffDayContext();

  useEffect(() => clear, [clear]);

  const { data, isLoading, isError, refetch } = useViewerCommitsByDay({
    login: viewer?.login,
    range: { from, to },
  });

  const byDate = useMemo(() => {
    const map = new Map<string, number>();
    if (data) {
      for (const [date, commits] of Object.entries(data.byDate)) map.set(date, commits);
    }
    return map;
  }, [data]);

  const effectiveWorkingDays = useMemo(
    () => countEffectiveWorkingDays({ from, to, ctx }),
    [ctx, from, to],
  );

  const summary = useMemo(
    () =>
      summarizeAverageCommitsPerDay({
        totalCommits: data?.totalCommits ?? 0,
        effectiveWorkingDays,
      }),
    [data?.totalCommits, effectiveWorkingDays],
  );

  const trendPoints = useMemo(
    () => (data
      ? buildAverageCommitsTrend({
          byDate,
          ctx,
          from,
          to,
          granularity:
            timeframe.kind === 'preset' && timeframe.preset === 'last-week'
              ? 'daily'
              : 'weekly',
        })
      : []),
    [byDate, ctx, data, from, timeframe, to],
  );

  const chartData = useMemo(
    () => trendPoints.map((point) => ({ label: point.label, average: round2(point.average) })),
    [trendPoints],
  );

  const state = resolveAverageCommitsPerDayTileState({
    hasData: data != null,
    isLoading: isLoading || offDayLoading,
    isError,
    totalCommits: data?.totalCommits ?? 0,
    effectiveWorkingDays,
  });

  return (
    <BentoTile
      title="average commits / day"
      titleTooltip={TILE_HELP.averageCommitsPerDay}
      icon={GraphIcon}
      state={state}
      area={BENTO_AREAS.AverageCommitsPerDay}
      onRetry={() => void refetch()}
      footer={
        state === 'loaded' ? (
          <VerdictLine>
            {averageVerdict({
              average: summary.average,
              totalCommits: summary.totalCommits,
              effectiveWorkingDays: summary.effectiveWorkingDays,
            })}
          </VerdictLine>
        ) : null
      }
    >
      <Stack gap="sm" miw={0}>
        <StatNumber
          value={formatAverage(summary.average)}
          unit="commits / effective working day"
        />

        <ChartWrap>
          <LineChart
            h={SPARKLINE_H}
            data={chartData}
            dataKey="label"
            series={[{ name: 'average', color: 'primerBlue.4' }]}
            curveType="monotone"
            withDots
            withTooltip={false}
            withXAxis={false}
            withYAxis={false}
            gridAxis="none"
            style={{ padding: 5 }}
          />
          {trendPoints.length > 0 ? (
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
          ) : null}
        </ChartWrap>

        {summary.isRestWindow ? (
          <Text size="xs" c="dimmed" ff="monospace">
            no effective working days in this timeframe.
          </Text>
        ) : null}

        <StatRow label="authored non-merge commits" value={String(summary.totalCommits)} />
        <StatRow label="effective working days" value={String(summary.effectiveWorkingDays)} />
      </Stack>
    </BentoTile>
  );
}
