import type React from 'react';
import { Box, Group, Stack, Text, Tooltip } from '@mantine/core';
import styled from 'styled-components';
import { ClockIcon } from '@primer/octicons-react';
import { useEffect, useMemo } from 'react';

import { useAuth } from '../../../hooks/useAuth';
import { useViewerCommitsByDay } from '../../../hooks/useGitHubQueries';
import { useHoverHighlight } from '../../../store/hoverHighlight';
import { rollingYearWindow } from '../../ConsistencyMap/contributions';
import { useStreakMode } from '../../../userData';
import { useOffDayContext } from '../../../userData/useOffDayContext';
import { currentStreakInfo, longestStreakInfo, streakDots, type StreakDot } from '../../../analytics/streaks';
import { BENTO_AREAS, BentoTile, TILE_HELP } from '..';
import { StatNumber, StatRow, VerdictLine } from './Stat';

const ModeChip = styled(Text)`
  font-size: 10px;
  font-family: var(--mantine-font-family-monospace);
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--gi-border-default);
  color: var(--gi-fg-muted);
  white-space: nowrap;
  line-height: 1.6;
` as typeof Text;

const DotRow = styled(Group)`
  gap: 4px;
  flex-wrap: nowrap;
  overflow: hidden;
` as typeof Group;

// Color driven via --dot-color CSS custom property set per dot via inline style.
const Dot = styled(Box)`
  width: 10px;
  height: 30px;
  border-radius: 5px;
  flex-shrink: 0;
  background: var(--dot-color);
  cursor: default;
  transition: transform 80ms;
  &:hover {
    transform: scale(1.3);
  }
` as typeof Box;

const MONTH_SHORT = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function dotColor(dot: StreakDot): string {
  if (dot.hit) return 'var(--gi-success-emphasis)';
  if (dot.verdict === 'eval') return 'var(--gi-danger-emphasis)';
  return 'var(--gi-border-default)'; // bonus day, optional skip
}

function StreakBar({ dots }: { dots: StreakDot[] }) {
  const { setRange, clear } = useHoverHighlight();

  useEffect(() => clear, [clear]);

  return (
    <DotRow mt={4}>
      {dots.map((d) => (
        <Tooltip key={d.date} label={fmtDate(d.date)} withArrow position="top" fz={10}>
          <Dot
            tabIndex={0}
            onMouseEnter={() => setRange({ from: d.date, to: d.date })}
            onMouseLeave={clear}
            onFocus={() => setRange({ from: d.date, to: d.date })}
            onBlur={clear}
            style={{ '--dot-color': dotColor(d) } as React.CSSProperties}
            aria-label={`${fmtDate(d.date)}: ${d.hit ? 'committed' : d.verdict === 'eval' ? 'missed' : 'skipped'}`}
          />
        </Tooltip>
      ))}
    </DotRow>
  );
}

function streakVerdict(current: number, mode: string): string {
  if (current === 0) {
    return mode === 'skip-non-workdays'
      ? 'no streak right now. commit any day to start — weekends count too.'
      : 'no streak right now. start whenever.';
  }
  if (current >= 30) return `${current} days running. when's the last time you took a day?`;
  if (current >= 7) return `${current} days. solid. don't turn it into a punishment.`;
  return `${current} days in. easy does it.`;
}

export function StreakTile(): JSX.Element {
  const { viewer } = useAuth();
  const window = useMemo(() => rollingYearWindow(), []);
  const mode = useStreakMode();
  const { ctx } = useOffDayContext();

  const { data, isLoading, isError, refetch } = useViewerCommitsByDay({
    login: viewer?.login,
    range: window,
  });

  const byDate = useMemo(() => {
    const m = new Map<string, number>();
    if (data) for (const [k, v] of Object.entries(data.byDate)) m.set(k, v);
    return m;
  }, [data]);

  const currentInfo = useMemo(
    () => (data ? currentStreakInfo({ byDate, ctx, mode }) : { days: 0, lastBrokenOn: null }),
    [byDate, ctx, data, mode],
  );
  const current = currentInfo.days;

  const longestInfo = useMemo(
    () => (data ? longestStreakInfo({ byDate, ctx, mode }) : { days: 0, brokenOn: null }),
    [byDate, ctx, data, mode],
  );

  const dots = useMemo(
    () => (data ? streakDots({ byDate, ctx, mode, maxDots: 21 }) : []),
    [byDate, ctx, data, mode],
  );

  let state: 'loading' | 'empty' | 'error' | 'loaded' = 'loading';
  if (data && data.totalCommits === 0) state = 'empty';
  else if (data) state = 'loaded';
  else if (isError) state = 'error';
  else if (isLoading) state = 'loading';

  const longestDaysValue =
    longestInfo.days === current && current > 0
      ? `${longestInfo.days} — still running`
      : String(longestInfo.days);

  const lastBrokenValue = currentInfo.lastBrokenOn ? fmtDate(currentInfo.lastBrokenOn) : '—';

  const modeLabel =
    mode === 'skip-non-workdays'
      ? 'weekends optional'
      : mode === 'workdays-only'
        ? 'workdays only'
        : 'every day counts';

  return (
    <BentoTile
      title="streak"
      titleTooltip={TILE_HELP.streak}
      icon={ClockIcon}
      state={state}
      area={BENTO_AREAS.Streak}
      onRetry={() => void refetch()}
      footer={state === 'loaded' ? <VerdictLine>{streakVerdict(current, mode)}</VerdictLine> : null}
    >
      <Stack gap="md">
        <Group justify="space-between" align="flex-end" wrap="nowrap">
          <StatNumber
            value={current}
            unit={mode === 'workdays-only' ? 'workdays — current' : 'days — current'}
          />
          <ModeChip component="span">{modeLabel}</ModeChip>
        </Group>
        {dots.length > 0 && <StreakBar dots={dots} />}

        <StatRow label="longest" value={longestDaysValue} />
        <StatRow label="last broken" value={lastBrokenValue} />
        {data?.coverage?.backfilling ? (
          <Text size="xs" c="dimmed" ff="monospace">
            loading older commits… streak updates as months arrive.
          </Text>
        ) : null}
      </Stack>
    </BentoTile>
  );
}
