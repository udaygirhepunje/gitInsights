import { Anchor, Box, Divider, Group, Stack, Text, Tooltip } from '@mantine/core';
import { GraphIcon } from '@primer/octicons-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

import { addDays, toIsoDateKey } from '../../../analytics/dates';
import { isHolidayDay, isPtoDay, isWorkday, type OffDayContext } from '../../../analytics/offDay';
import { aggregateTechStack, type LanguageSlice } from '../../../analytics/techStack';
import { useViewerRepoLanguages } from '../../../hooks/useGitHubQueries';
import { useTimeframe } from '../../../hooks/useTimeframe';
import type { Timeframe } from '../../../userData/schema';
import { useOffDayContext } from '../../../userData/useOffDayContext';
import { BENTO_AREAS, BentoTile, TILE_HELP } from '..';
import { metricMonoStyle } from './metricMonoStyle';
import { VerdictLine } from './Stat';

const StackBar = styled(Group)`
  width: 100%;
  height: 12px;
  border-radius: 999px;
  overflow: hidden;
  background: var(--gi-bg-muted);
` as typeof Group;

function periodWord(tf: Timeframe): string {
  if (tf.kind === 'preset') {
    const words: Record<string, string> = {
      'last-week': 'week',
      'last-30-days': 'month',
      'last-3-months': 'quarter',
      'last-6-months': 'half-year',
      'last-year': 'year',
    };
    return words[tf.preset] ?? 'period';
  }
  if (tf.kind === 'month') return 'month';
  if (tf.kind === 'quarter') return 'quarter';
  return 'period';
}

function colorFor(slice: LanguageSlice, idx: number): string {
  if (slice.color) return slice.color;
  const palette = [
    'var(--mantine-color-primerBlue-4)',
    'var(--mantine-color-primerGreen-4)',
    'var(--mantine-color-primerYellow-4)',
    'var(--mantine-color-primerOrange-4)',
    'var(--mantine-color-primerPurple-4)',
    'var(--mantine-color-primerPink-4)',
    'var(--mantine-color-primerGray-5)',
  ];
  return palette[idx % palette.length] ?? 'var(--mantine-color-primerGray-5)';
}

// ─── Upcoming PTO calendar ───────────────────────────────────────────────────

const WEEK_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTH_SHORT = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const CalGrid = styled(Box)`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
` as typeof Box;

const DayCell = styled(Box)<{ 'data-today'?: boolean; 'data-pto'?: boolean; 'data-holiday'?: boolean; 'data-off'?: boolean }>`
  border-radius: 8px;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-family: var(--mantine-font-family-monospace);
  font-weight: ${(p) => (p['data-pto'] ?? p['data-holiday'] ?? false) ? 700 : 400};
  cursor: default;
  user-select: none;
  background: ${(p) => {
    if (p['data-pto'] ?? false) return 'var(--mantine-color-primerYellow-5)';
    if (p['data-holiday'] ?? false) return 'color-mix(in srgb, var(--mantine-color-primerYellow-5) 55%, transparent)';
    if (p['data-off'] ?? false) return 'color-mix(in srgb, var(--gi-bg-muted) 60%, transparent)';
    return 'var(--gi-bg-muted)';
  }};
  color: ${(p) => (p['data-pto'] ?? p['data-holiday'] ?? false) ? 'var(--gi-bg-default)' : 'var(--gi-fg-default)'};
  border: ${(p) => (p['data-today'] ?? false) ? '2px solid var(--mantine-color-primerBlue-4)' : '1px solid transparent'};
  opacity: ${(p) => (p['data-off'] ?? false) ? 0.45 : 1};
  transition: opacity 0.15s;
` as typeof Box;

const WeekdayLabel = styled(Text)`
  font-size: 10px;
  font-family: var(--mantine-font-family-monospace);
  text-transform: uppercase;
  color: var(--gi-fg-muted);
  text-align: center;
` as typeof Text;

const ManageChip = styled(Anchor)`
  font-size: 10px;
  font-family: var(--mantine-font-family-monospace);
  color: var(--gi-fg-muted);
  border: 1px solid var(--gi-border-default);
  border-radius: 999px;
  padding: 2px 10px;
  white-space: nowrap;
  text-decoration: none;
  &:hover { color: var(--gi-fg-default); }
` as typeof Anchor;

function getMondayOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function UpcomingPto({ ctx }: { ctx: OffDayContext }) {
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toIsoDateKey(today), [today]);

  const days = useMemo(() => {
    const startMon = getMondayOfWeek(today);
    return Array.from({ length: 14 }, (_, i) => addDays(startMon, i));
  }, [today]);

  const ptoInNext14 = useMemo(() => {
    const endDate = addDays(today, 13);
    return days.filter((d) => {
      const key = toIsoDateKey(d);
      return d >= today && d <= endDate && (isPtoDay(key, ctx) || isHolidayDay(key, ctx));
    }).length;
  }, [days, today, ctx]);

  const monthLabel = useMemo(() => {
    const m1 = MONTH_SHORT[days[0]?.getMonth() ?? 0] ?? 'jan';
    const m2 = MONTH_SHORT[days[13]?.getMonth() ?? 0] ?? 'jan';
    return m1 === m2 ? m1 : `${m1}-${m2}`;
  }, [days]);

  return (
    <Stack gap={8}>
      <Group justify="space-between" align="center" wrap="nowrap">
        <Text size="xs" tt="uppercase" ff="monospace" c="dimmed" fw={600} style={{ letterSpacing: '0.08em', fontSize: 10 }}>
          pto · upcoming
        </Text>
        <ManageChip component={Link} to="/settings">
          manage in /settings
        </ManageChip>
      </Group>

      <CalGrid>
        {WEEK_DAYS.map((d, i) => (
          <WeekdayLabel key={i}>{d}</WeekdayLabel>
        ))}
        {days.map((d) => {
          const key = toIsoDateKey(d);
          const isPto = isPtoDay(key, ctx);
          const isHoliday = isHolidayDay(key, ctx);
          const isOff = !isWorkday(key, ctx.workdays) && !isPto && !isHoliday;
          const isToday = key === todayKey;
          const label = d.getDate();
          const tooltipLabel = isPto ? 'pto' : isHoliday ? 'holiday' : isOff ? 'off' : undefined;
          const cell = (
            <DayCell
              key={key}
              data-today={isToday || undefined}
              data-pto={isPto || undefined}
              data-holiday={isHoliday || undefined}
              data-off={isOff || undefined}
            >
              {label}
            </DayCell>
          );
          return tooltipLabel ? (
            <Tooltip key={key} label={tooltipLabel} withArrow fz={10} position="top">
              {cell}
            </Tooltip>
          ) : (
            <span key={key}>{cell}</span>
          );
        })}
      </CalGrid>

      <Group justify="space-between" wrap="nowrap" mt={2}>
        <Text size="xs" c="dimmed" ff="monospace">
          {ptoInNext14 > 0 ? `${ptoInNext14} day${ptoInNext14 !== 1 ? 's' : ''} off in next 14d.` : 'no pto in the next 14 days.'}
        </Text>
        <Text size="xs" c="dimmed" ff="monospace">
          {monthLabel}
        </Text>
      </Group>
    </Stack>
  );
}

export function TechStackTile(): JSX.Element {
  const { from, to, label, timeframe } = useTimeframe();
  const { data, isLoading, isError, refetch } = useViewerRepoLanguages();
  const { ctx } = useOffDayContext();
  const slices = useMemo(
    () => (data ? aggregateTechStack(data, { from, to }) : []),
    [data, from, to],
  );

  let state: 'loading' | 'empty' | 'error' | 'loaded' = 'loading';
  if (data && slices.length === 0) state = 'empty';
  else if (data) state = 'loaded';
  else if (isError) state = 'error';
  else if (isLoading) state = 'loading';

  const top = slices[0];

  return (
    <BentoTile
      title={`tech stack · ${label}`}
      titleTooltip={TILE_HELP.techStack}
      icon={GraphIcon}
      state={state}
      area={BENTO_AREAS.TechStack}
      onRetry={() => void refetch()}
      emptyMessage="no language data in the selected timeframe. ship something."
    >
      <Stack gap="sm">
        <StackBar gap={0} wrap="nowrap">
          {slices.map((slice, idx) => (
            <Box
              key={slice.name}
              style={{
                height: '100%',
                background: colorFor(slice, idx),
                flexBasis: `${slice.share * 100}%`,
              }}
            />
          ))}
        </StackBar>
        <Stack gap={4}>
          {slices.map((slice, idx) => (
            <Group key={slice.name} justify="space-between" gap="xs" wrap="nowrap">
              <Group gap="xs" wrap="nowrap">
                <Box
                  aria-hidden
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: colorFor(slice, idx),
                    flexShrink: 0,
                  }}
                />
                <Text size="sm">{slice.name}</Text>
              </Group>
              <Text size="sm" c="dimmed" fw={600} style={metricMonoStyle}>
                {Math.round(slice.share * 100)}%
              </Text>
            </Group>
          ))}
        </Stack>

        {state === 'loaded' && top && (
          <VerdictLine>
            <Text component="span" style={metricMonoStyle}>
              {Math.round(top.share * 100)}%
            </Text>{' '}
            {top.name}. {top.share > 0.7 ? `a one-language ${periodWord(timeframe)}.` : 'a healthy mix.'}
          </VerdictLine>
        )}

        <Divider my={4} variant="dashed" />
        <UpcomingPto ctx={ctx} />
      </Stack>
    </BentoTile>
  );
}
