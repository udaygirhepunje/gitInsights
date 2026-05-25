import { Box, Stack, Text, Tooltip } from '@mantine/core';
import { LineChart } from '@mantine/charts';
import { FlameIcon } from '@primer/octicons-react';
import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';

import { useAuth } from '../../../hooks/useAuth';
import { useTimeframe } from '../../../hooks/useTimeframe';
import { useViewerCommitsByDay } from '../../../hooks/useGitHubQueries';
import { useHoverHighlight } from '../../../store/hoverHighlight';
import { useUserDataVersions } from '../../../userData';
import { runCommitMomentum } from '../../../workers/client';
import type { CommitMomentumInput, MomentumResult } from '../../../analytics/diffDelta';
import { formatDisplayDayMonth, toIsoDateKey } from '../../../analytics/dates';
import { BENTO_AREAS, BentoTile, TILE_HELP } from '..';
import { StatNumber, VerdictLine } from './Stat';

const SPARKLINE_H = 80;

const ChartHoverWrap = styled(Box)`
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

function timestampsToMomentumCommits(timestamps: string[]): CommitMomentumInput[] {
  return timestamps.map((authoredAt) => ({ authoredAt }));
}

function buildSparkline(
  perDay: Record<string, number>,
  from: Date,
  to: Date,
): Array<{ date: string; isoDate: string; momentum: number }> {
  const out: Array<{ date: string; isoDate: string; momentum: number }> = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    const key = toIsoDateKey(cursor);
    out.push({
      date: formatDisplayDayMonth(key),
      isoDate: key,
      momentum: Math.round((perDay[key] ?? 0) * 10) / 10,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function momentumVerdict(total: number, totalCommits: number, label: string): string {
  if (totalCommits === 0) {
    return `no commits in ${label}. either you’re new, on PTO, or actually resting. all valid.`;
  }
  if (total < 50) return `low momentum in ${label}. that’s fine. quality > volume.`;
  if (total < 200) return 'steady. nothing to prove here.';
  return `busy ${label}. the score isn’t the point — make sure the rest is too.`;
}

export function EPTile(): JSX.Element {
  const { viewer } = useAuth();
  const { from, to, label } = useTimeframe();
  const { setRange, clear } = useHoverHighlight();
  const versions = useUserDataVersions();

  useEffect(() => clear, [clear]);

  const { data, isLoading, isError, refetch } = useViewerCommitsByDay({
    login: viewer?.login,
    range: { from, to },
  });

  const [momentum, setMomentum] = useState<MomentumResult | null>(null);
  const [computing, setComputing] = useState(false);

  useEffect(() => {
    if (!data || !viewer) return;
    let cancelled = false;
    setComputing(true);
    void runCommitMomentum({
      userId: viewer.login,
      shaRange: `${data.fromIso}..${data.toIso}:n${data.totalCommits}`,
      fromIso: data.fromIso,
      toIso: data.toIso,
      commits: timestampsToMomentumCommits(data.timestamps),
      workweekVersion: versions.workweek,
      ptoVersion: versions.pto,
      holidaysVersion: versions.holidays,
    })
      .then((result) => {
        if (!cancelled) setMomentum(result);
      })
      .finally(() => {
        if (!cancelled) setComputing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [data, versions.holidays, versions.pto, versions.workweek, viewer]);

  const total = momentum?.total ?? 0;
  const sparkline = useMemo(
    () => buildSparkline(momentum?.perDay ?? {}, from, to),
    [momentum, from, to],
  );

  let state: 'loading' | 'empty' | 'error' | 'loaded' = 'loading';
  if (data && data.totalCommits === 0) state = 'empty';
  else if (data && momentum) state = 'loaded';
  else if (data) state = 'loading';
  else if (isError) state = 'error';
  else if (isLoading || computing) state = 'loading';

  return (
    <BentoTile
      title={`commit momentum · ${label}`}
      titleTooltip={TILE_HELP.commitMomentum}
      icon={FlameIcon}
      state={state}
      area={BENTO_AREAS.EP}
      onRetry={() => void refetch()}
      footer={
        state === 'loaded' ? (
          <VerdictLine>{momentumVerdict(total, data?.totalCommits ?? 0, label)}</VerdictLine>
        ) : null
      }
    >
      <Stack gap="md" miw={0}>
        {/* <Group justify="space-between" align="flex-end"> */}
          <StatNumber value={Math.round(total).toLocaleString()} unit="pts" hero />
          <Text size="xs" c="dimmed">
            recency-weighted commits
          </Text>
        {/* </Group> */}
        <ChartHoverWrap>
          <LineChart
            h={SPARKLINE_H}
            data={sparkline}
            dataKey="date"
            series={[{ name: 'momentum', color: 'primerBlue.4' }]}
            curveType="monotone"
            withDots={false}
            withTooltip={false}
            withXAxis={false}
            withYAxis={false}
            gridAxis="none"
            style={{ padding: 1 }}
          />
          {sparkline.length > 0 ? (
            <ChartHoverLayer onMouseLeave={clear}>
              {sparkline.map((point) => (
                <Tooltip
                  key={point.isoDate}
                  label={`${point.date} · ${point.momentum} momentum`}
                  withArrow
                  position="top"
                  withinPortal
                  fz={10}
                >
                  <ChartHoverSlice
                    onMouseEnter={() => setRange({ from: point.isoDate, to: point.isoDate })}
                    aria-label={`${point.isoDate}: ${point.momentum} momentum`}
                  />
                </Tooltip>
              ))}
            </ChartHoverLayer>
          ) : null}
        </ChartHoverWrap>
      </Stack>
    </BentoTile>
  );
}
