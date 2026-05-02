import { Box, Stack, Text, Tooltip } from '@mantine/core';
import { useMemo } from 'react';
import styled from 'styled-components';

import { useHoverHighlight } from '../../store/hoverHighlight';
import type { ContributionWindow, HeatmapRow } from './contributions';

// Spec §6 Consistency. Pure CSS-grid heatmap (53-week × 7-day) using
// `aspect-ratio: 1` cells; the outer wrapper's `overflow-x: auto` handles
// narrow viewports. `cellAdornments(date)` is the seam through which PTO +
// Public Holiday colors and the violation dot overlay land.

export type CellAdornment = {
  color?: string;
  overlayDot?: boolean;
  label?: string;
  /** When true, paints a bottom-left wedge so public holidays read distinct from PTO (same base color). */
  publicHoliday?: boolean;
  /** Subtitle for tooltip (PTO title / holiday names), without the category prefix. */
  tooltipDetail?: string;
};

export type ConsistencyMapProps = {
  rows: HeatmapRow[];
  window: ContributionWindow;
  cellAdornments?: (date: string) => CellAdornment | undefined;
};

const WEEK_COLUMNS = 53;
const DAYS_PER_WEEK = 7;
const GRID_MIN_PX = 680;
const GRID_GAP_PX = 3;
const HIGHLIGHT_STROKE_PX = 2;
const USE_GROUPED_RANGE_HIGHLIGHT = false;
const BUCKET_THRESHOLDS = [1, 3, 6, 10] as const;

const WEEKDAY_SHORT = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const MONTH_SHORT = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
] as const;

const Shell = styled(Box)`
  width: 100%;
  overflow-x: auto;
  padding-block: ${({ theme }) => theme.spacing.xs};
` as typeof Box;

const Inner = styled(Box)`
  min-width: ${GRID_MIN_PX}px;
  display: grid;
  grid-template-columns: 24px 1fr;
  column-gap: ${({ theme }) => theme.spacing.xs};
  row-gap: 4px;
` as typeof Box;

const MonthsRow = styled(Box)`
  grid-column: 2 / 3;
  display: grid;
  grid-template-columns: repeat(${WEEK_COLUMNS}, 1fr);
  font-size: 10px;
  color: var(--gi-fg-muted);
  font-family: var(--gi-mono, ui-monospace, monospace);
  margin-bottom: 2px;

  span {
    min-width: 0;
    white-space: nowrap;
  }
` as typeof Box;

const DayLabels = styled(Box)`
  display: grid;
  grid-template-rows: repeat(${DAYS_PER_WEEK}, 1fr);
  align-items: center;
  font-size: 10px;
  color: var(--gi-fg-muted);
  font-family: var(--gi-mono, ui-monospace, monospace);
` as typeof Box;

const Grid = styled(Box)`
  display: grid;
  grid-template-columns: repeat(${WEEK_COLUMNS}, 1fr);
  grid-auto-rows: 1fr;
  gap: ${GRID_GAP_PX}px;
  padding: ${({ theme }) => theme.spacing.xs};

  &[data-gi-has-highlight='true'] > *[data-gi-highlighted='true'] {
    transition: opacity 80ms linear;
  }
` as typeof Box;

const Cell = styled(Box)`
  aspect-ratio: 1;
  box-sizing: border-box;
  border-radius: 2px;
  background: var(--gi-heatmap-0);
  position: relative;
  min-width: 0;

  @keyframes gi-pending-pulse {
    0%,
    100% {
      opacity: 0.55;
    }
    50% {
      opacity: 0.85;
    }
  }

  &[data-gi-pending='true'] {
    animation: gi-pending-pulse 1.2s ease-in-out infinite;
  }

  &:hover {
    outline: ${HIGHLIGHT_STROKE_PX}px solid var(--gi-focus-outline);
  }

  &[data-lvl='1'] {
    background: var(--gi-heatmap-1);
  }
  &[data-lvl='2'] {
    background: var(--gi-heatmap-2);
  }
  &[data-lvl='3'] {
    background: var(--gi-heatmap-3);
  }
  &[data-lvl='4'] {
    background: var(--gi-heatmap-4);
  }

  &[data-out-of-range='true'] {
    background: transparent;
    box-shadow: inset 0 0 0 1px var(--gi-border-muted);
    opacity: 0.4;
  }

  &[data-gi-holiday='true']::before {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0;
    width: 0;
    height: 0;
    border-style: solid;
    border-width: 0;
    border-bottom: 6px solid var(--mantine-color-primerOrange-7);
    border-right: 6px solid transparent;
    pointer-events: none;
  }

  &[data-gi-highlighted='true'] {
    z-index: 2;
  }

  &[data-gi-highlighted='true'][data-gi-highlight-mode='cell'] {
    outline: ${HIGHLIGHT_STROKE_PX}px solid var(--gi-focus-outline);
  }

  &[data-gi-violation='true']::after {
    content: '';
    position: absolute;
    right: 0;
    bottom: 0;
    width: 5px;
    height: 5px;
    border-radius: 999px;
    /* Deep fill + fg-colored ring so the marker reads on amber off-day cells (WCAG-ish separation). */
    background: var(--gi-heatmap-violation, var(--mantine-color-primerRed-5));
    box-shadow:
      0 0 0 2px var(--gi-bento-tile-bg);
    z-index: 1;
  }
` as typeof Box;

const HighlightEdge = styled(Box)`
  position: absolute;
  pointer-events: none;
  background: var(--gi-focus-outline);
  z-index: 3;

  &[data-edge='top'] {
    top: -${HIGHLIGHT_STROKE_PX / 2}px;
    left: -${GRID_GAP_PX / 2}px;
    right: -${GRID_GAP_PX / 2}px;
    height: ${HIGHLIGHT_STROKE_PX}px;
  }

  &[data-edge='right'] {
    top: -${GRID_GAP_PX / 2}px;
    right: -${HIGHLIGHT_STROKE_PX / 2}px;
    bottom: -${GRID_GAP_PX / 2}px;
    width: ${HIGHLIGHT_STROKE_PX}px;
  }

  &[data-edge='bottom'] {
    right: -${GRID_GAP_PX / 2}px;
    bottom: -${HIGHLIGHT_STROKE_PX / 2}px;
    left: -${GRID_GAP_PX / 2}px;
    height: ${HIGHLIGHT_STROKE_PX}px;
  }

  &[data-edge='left'] {
    top: -${GRID_GAP_PX / 2}px;
    bottom: -${GRID_GAP_PX / 2}px;
    left: -${HIGHLIGHT_STROKE_PX / 2}px;
    width: ${HIGHLIGHT_STROKE_PX}px;
  }
` as typeof Box;

function bucketOf(count: number): number {
  if (count <= 0) return 0;
  for (let i = 0; i < BUCKET_THRESHOLDS.length; i += 1) {
    const threshold = BUCKET_THRESHOLDS[i];
    if (threshold !== undefined && count < threshold) return i;
  }
  return BUCKET_THRESHOLDS.length;
}

function toIsoDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfGrid(from: Date): Date {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateLabel(date: Date): string {
  const weekday = WEEKDAY_SHORT[date.getDay()] ?? '';
  const month = MONTH_SHORT[date.getMonth()] ?? '';
  return `${weekday}, ${month} ${date.getDate()}`;
}

function formatCountLine(count: number): string {
  if (count === 0) return 'no commits.';
  if (count === 1) return '1 commit.';
  return `${count.toLocaleString()} commits.`;
}

/**
 * Tooltip surface follows the active color scheme (see `mantineTheme` in
 * `src/theme/mantine-theme.ts`, which overrides `--tooltip-bg` /
 * `--tooltip-color`): light app → light tooltip + default dark text; dark app
 * → dark tooltip + default light text. Date / muted lines use `inherit` so
 * they always pick up that text color. Don't use `c="bright"` / hardcoded
 * near-white — those still break in light mode's white tooltip.
 */
const TT_COMMITS_ON = 'var(--mantine-color-primerGreen-4)';
const TT_PTO_HEAD = 'var(--mantine-color-primerYellow-4)';
const TT_PTO_DETAIL = 'var(--mantine-color-primerYellow-2)';
const TT_HOL_HEAD = 'var(--mantine-color-primerOrange-5)';
const TT_HOL_DETAIL = 'var(--mantine-color-primerOrange-3)';
const TT_VIOLATION = 'var(--mantine-color-primerRed-4)';

type TooltipOffDay = { type: 'pto' | 'publicHoliday'; detail: string };

type TooltipFacts = {
  date: Date;
  inRange: boolean;
  count: number;
  label: string | undefined;
  offDay: TooltipOffDay | undefined;
  violation: boolean;
  pending?: boolean;
};

function CellTooltipContent({ facts }: { facts: TooltipFacts }): JSX.Element {
  if (!facts.inRange) {
    return (
      <Stack gap={6}>
        <Text size="xs" fw={600} style={{ color: 'inherit' }}>
          {formatDateLabel(facts.date)}
        </Text>
        <Text size="xs" style={{ color: 'inherit', opacity: 0.72 }}>
          outside the 365-day window.
        </Text>
      </Stack>
    );
  }

  if (facts.pending) {
    return (
      <Stack gap={6}>
        <Text size="xs" fw={600} style={{ color: 'inherit' }}>
          {formatDateLabel(facts.date)}
        </Text>
        <Text size="xs" style={{ color: 'inherit', opacity: 0.72 }}>
          loading older commit data for this month…
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap={6}>
      <Text size="xs" fw={600} style={{ color: 'inherit' }}>
        {formatDateLabel(facts.date)}
      </Text>

      <Text
        size="xs"
        fw={600}
        style={
          facts.count > 0 ? { color: TT_COMMITS_ON } : { color: 'inherit', opacity: 0.72 }
        }
      >
        {formatCountLine(facts.count)}
      </Text>

      {facts.offDay ? (
        <Text size="xs" component="div" lh={1.45}>
          {facts.offDay.type === 'pto' ? (
            <>
              <Text span fw={700} style={{ color: TT_PTO_HEAD }}>
                pto
              </Text>
              {facts.offDay.detail ? (
                <Text span fw={500} style={{ color: TT_PTO_DETAIL }}>
                  {` · ${facts.offDay.detail}`}
                </Text>
              ) : null}
            </>
          ) : (
            <>
              <Text span fw={700} style={{ color: TT_HOL_HEAD }}>
                public holiday
              </Text>
              {facts.offDay.detail ? (
                <Text span fw={500} style={{ color: TT_HOL_DETAIL }}>
                  {` · ${facts.offDay.detail}`}
                </Text>
              ) : null}
            </>
          )}
        </Text>
      ) : null}

      {facts.violation ? (
        <Text size="xs" fw={700} style={{ color: TT_VIOLATION }}>
          pto violation — commits on this off-day.
        </Text>
      ) : null}
    </Stack>
  );
}

export function ConsistencyMap({
  rows,
  window,
  cellAdornments,
}: ConsistencyMapProps): JSX.Element {
  const highlightRange = useHoverHighlight((s) => s.range);
  const hasHighlight =
    highlightRange !== null && (highlightRange.dates === undefined || highlightRange.dates.length > 0);

  const byDate = useMemo(() => {
    const m = new Map<string, HeatmapRow>();
    rows.forEach((r) => m.set(r.date, r));
    return m;
  }, [rows]);

  const grid = useMemo(() => {
    const gridStart = startOfGrid(window.from);
    const fromTime = new Date(window.from);
    fromTime.setHours(0, 0, 0, 0);
    const toTime = new Date(window.to);
    toTime.setHours(23, 59, 59, 999);

    const cells: Array<{
      key: string;
      facts: TooltipFacts;
      level: number;
      color?: string;
      violation?: boolean;
      publicHoliday?: boolean;
      highlighted?: boolean;
      highlightEdges?: {
        top: boolean;
        right: boolean;
        bottom: boolean;
        left: boolean;
      };
    }> = [];

    const highlightedDateSet = highlightRange?.dates ? new Set(highlightRange.dates) : null;

    const isHighlightedDate = (date: Date): boolean => {
      if (highlightRange === null) return false;
      const dateKey = toIsoDateKey(date);
      if (highlightedDateSet) return date >= fromTime && date <= toTime && highlightedDateSet.has(dateKey);
      return date >= fromTime && date <= toTime && dateKey >= highlightRange.from && dateKey <= highlightRange.to;
    };

    for (let row = 0; row < DAYS_PER_WEEK; row += 1) {
      for (let col = 0; col < WEEK_COLUMNS; col += 1) {
        const date = addDays(gridStart, col * DAYS_PER_WEEK + row);
        const dateKey = toIsoDateKey(date);
        const inRange = date >= fromTime && date <= toTime;
        const heatmapRow = byDate.get(dateKey);
        const count = inRange ? (heatmapRow?.count ?? 0) : 0;
        const pending = inRange ? (heatmapRow?.pending ?? false) : false;
        const level = inRange && !pending ? bucketOf(count) : 0;
        const adorn = inRange ? cellAdornments?.(dateKey) : undefined;
        const offDay: TooltipOffDay | undefined =
          adorn?.color != null
            ? {
                type: adorn.publicHoliday ? 'publicHoliday' : 'pto',
                detail: adorn.tooltipDetail ?? '',
              }
            : undefined;
        const highlighted = isHighlightedDate(date);
        const highlightEdges = highlighted
          ? {
              top: row === 0 || !isHighlightedDate(addDays(date, -1)),
              right: col === WEEK_COLUMNS - 1 || !isHighlightedDate(addDays(date, DAYS_PER_WEEK)),
              bottom: row === DAYS_PER_WEEK - 1 || !isHighlightedDate(addDays(date, 1)),
              left: col === 0 || !isHighlightedDate(addDays(date, -DAYS_PER_WEEK)),
            }
          : undefined;

        cells.push({
          key: `${row}-${col}`,
          facts: {
            date,
            inRange,
            count,
            label: adorn?.label,
            offDay,
            violation: adorn?.overlayDot ?? false,
            pending,
          },
          level,
          color: adorn?.color,
          violation: adorn?.overlayDot,
          publicHoliday: adorn?.publicHoliday,
          highlighted,
          highlightEdges,
        });
      }
    }

    return cells;
  }, [byDate, cellAdornments, window.from, window.to, highlightRange]);

  const months = useMemo(() => {
    const gridStart = startOfGrid(window.from);
    const labels: Array<{ col: number; text: string }> = [];
    let prev = -1;
    for (let col = 0; col < WEEK_COLUMNS; col += 1) {
      const d = addDays(gridStart, col * DAYS_PER_WEEK);
      const m = d.getMonth();
      if (m !== prev) {
        labels.push({ col, text: MONTH_SHORT[m] ?? '' });
        prev = m;
      }
    }
    return labels;
  }, [window.from]);

  return (
    <Shell>
      <Inner>
        <MonthsRow>
          {Array.from({ length: WEEK_COLUMNS }).map((_, col) => {
            const label = months.find((lbl) => lbl.col === col)?.text ?? '';
            return <span key={col}>{label}</span>;
          })}
        </MonthsRow>
        <DayLabels aria-hidden="true">
          <span />
          <span>mon</span>
          <span />
          <span>wed</span>
          <span />
          <span>fri</span>
          <span />
        </DayLabels>
        <Grid role="presentation" data-gi-has-highlight={hasHighlight ? 'true' : undefined}>
          {grid.map((cell) => (
            <Tooltip
              key={cell.key}
              label={<CellTooltipContent facts={cell.facts} />}
              multiline
              maw={320}
              position="top"
              withArrow
              withinPortal
              closeDelay={40}
              transitionProps={{ duration: 80 }}
              events={{ hover: true, focus: true, touch: true }}
            >
              <Cell
                data-lvl={cell.level > 0 ? String(cell.level) : undefined}
                data-gi-pending={cell.facts.pending ? 'true' : undefined}
                data-out-of-range={cell.facts.inRange ? undefined : 'true'}
                data-gi-holiday={cell.publicHoliday ? 'true' : undefined}
                data-gi-violation={cell.violation ? 'true' : undefined}
                data-gi-highlighted={cell.highlighted ? 'true' : undefined}
                data-gi-highlight-mode={USE_GROUPED_RANGE_HIGHLIGHT ? 'group' : 'cell'}
                style={cell.color ? { background: cell.color } : undefined}
                tabIndex={cell.facts.inRange ? 0 : -1}
                aria-label={
                  cell.facts.inRange
                    ? [
                        formatDateLabel(cell.facts.date),
                        cell.facts.label,
                        formatCountLine(cell.facts.count).replace(/\.$/, ''),
                        cell.facts.violation ? 'commits on off-day' : '',
                      ]
                        .filter((s) => Boolean(s && String(s).trim()))
                        .join('. ')
                    : undefined
                }
              >
                {USE_GROUPED_RANGE_HIGHLIGHT && cell.highlightEdges?.top ? (
                  <HighlightEdge data-edge="top" />
                ) : null}
                {USE_GROUPED_RANGE_HIGHLIGHT && cell.highlightEdges?.right ? (
                  <HighlightEdge data-edge="right" />
                ) : null}
                {USE_GROUPED_RANGE_HIGHLIGHT && cell.highlightEdges?.bottom ? (
                  <HighlightEdge data-edge="bottom" />
                ) : null}
                {USE_GROUPED_RANGE_HIGHLIGHT && cell.highlightEdges?.left ? (
                  <HighlightEdge data-edge="left" />
                ) : null}
              </Cell>
            </Tooltip>
          ))}
        </Grid>
      </Inner>
    </Shell>
  );
}
