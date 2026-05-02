import { Box, Button, Group, Popover, Stack, Text, UnstyledButton } from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import { ChevronDownIcon } from '@primer/octicons-react';
import { useState } from 'react';
import styled from 'styled-components';

import { toIsoDateKey } from '../../analytics/dates';
import {
  MAX_WINDOW_DAYS,
  PRESET_LABELS,
  PRESET_SPAN_TAGS,
  windowSpanDays,
} from '../../analytics/timeframe';
import { useTimeframe } from '../../hooks/useTimeframe';
import type { PresetId } from '../../userData/schema';

const PRESETS: PresetId[] = [
  'last-week',
  'last-30-days',
  'last-3-months',
  'last-6-months',
  'last-year',
];

const MONTH_ABBR = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const Pill = styled(UnstyledButton)`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--gi-border-default);
  background: var(--gi-bg-muted);
  color: var(--gi-fg-default);
  font-size: 12px;
  font-weight: 600;
  font-family: var(--mantine-font-family-monospace);
  cursor: pointer;
  transition: border-color 120ms, box-shadow 120ms;
  &[data-active] {
    border-color: var(--mantine-color-primerBlue-4);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--mantine-color-primerBlue-4) 18%, transparent);
  }
  &:hover {
    border-color: var(--mantine-color-primerBlue-4);
  }
` as typeof UnstyledButton;

const PresetBtn = styled(UnstyledButton)`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--gi-fg-default);
  background: transparent;
  width: 100%;
  cursor: pointer;
  &[data-selected] {
    color: var(--mantine-color-primerBlue-4);
    background: color-mix(in srgb, var(--mantine-color-primerBlue-4) 15%, transparent);
  }
  &:hover:not([data-selected]) {
    background: var(--gi-bg-muted);
  }
` as typeof UnstyledButton;

const GridBtn = styled(UnstyledButton)`
  text-align: center;
  padding: 6px 4px;
  font-size: 11px;
  font-family: var(--mantine-font-family-monospace);
  border: 1px solid var(--gi-border-muted);
  border-radius: 6px;
  background: transparent;
  color: var(--gi-fg-default);
  cursor: pointer;
  transition: background 80ms;
  border: 1px solid var(--gi-border-default);
  &[data-selected] {
    background: var(--mantine-color-primerBlue-4);
    color: var(--gi-fg-on-emphasis);
    border-color: var(--mantine-color-primerBlue-4);
  }
  &[data-disabled] {
    opacity: 0.35;
    cursor: not-allowed;
    pointer-events: none;
  }
  &:hover:not([data-selected]):not([data-disabled]) {
    background: var(--gi-bg-muted);
  }
` as typeof UnstyledButton;

const Hint = styled(Box)`
  font-size: 11px;
  font-family: var(--mantine-font-family-monospace);
  padding: 8px 10px;
  border: 1px dashed var(--gi-attention-fg);
  border-radius: 6px;
  background: color-mix(in srgb, var(--gi-attention-fg) 8%, transparent);
  color: var(--gi-attention-fg);
  line-height: 1.5;
  margin-top: 8px;
` as typeof Box;

// Wrapper that gives the Mantine DatePicker the compact bordered look from the mock.
const CalendarBox = styled(Box)`
  border: 1px solid var(--gi-border-muted);
  border-radius: 8px;
  padding: 10px;

  /* calendar header (month name + nav arrows) */
  [data-dates-input] { font-family: var(--mantine-font-family-monospace); }

  .mantine-DatePicker-calendarHeader {
    min-height: unset;
    margin-bottom: 6px;
  }
  .mantine-DatePicker-calendarHeaderLevel {
    font-family: var(--mantine-font-family-monospace);
    font-size: 11px;
    font-weight: 500;
    color: var(--gi-fg-muted);
    text-transform: lowercase;
  }
  .mantine-DatePicker-calendarHeaderControl {
    width: 20px;
    height: 20px;
    min-width: unset;
    color: var(--gi-fg-muted);
  }

  /* day-of-week row */
  .mantine-DatePicker-weekday {
    font-family: var(--mantine-font-family-monospace);
    font-size: 9px;
    text-transform: uppercase;
    color: var(--gi-fg-subtle);
    padding: 4px 0;
    width: 28px;
  }

  /* individual day cells */
  .mantine-DatePicker-day {
    font-family: var(--mantine-font-family-monospace);
    font-size: 11px;
    width: 28px;
    height: 24px;
    border-radius: 4px;
    padding: 0;
    line-height: 24px;
    text-align: center;
    color: var(--gi-fg-default);

    &[data-outside] {
      color: var(--gi-fg-subtle);
      opacity: 0.4;
    }
    &[data-disabled] {
      color: var(--gi-fg-subtle);
      opacity: 0.25;
      text-decoration: line-through;
    }
    &[data-in-range] {
      background: color-mix(in srgb, var(--mantine-color-primerBlue-4) 18%, transparent);
      border-radius: 0;
    }
    &[data-first-in-range] {
      background: var(--mantine-color-primerBlue-4);
      color: var(--gi-fg-on-emphasis);
      border-radius: 4px 0 0 4px;
    }
    &[data-last-in-range] {
      background: var(--mantine-color-primerBlue-4);
      color: var(--gi-fg-on-emphasis);
      border-radius: 0 4px 4px 0;
    }
    &[data-selected] {
      background: var(--mantine-color-primerBlue-4);
      color: var(--gi-fg-on-emphasis);
      border-radius: 4px;
    }
    &:hover:not([data-selected]):not([data-in-range]):not([data-disabled]) {
      background: var(--gi-bg-muted);
    }
  }

  .mantine-DatePicker-monthsListCell,
  .mantine-DatePicker-yearsListCell {
    font-family: var(--mantine-font-family-monospace);
    font-size: 11px;
  }
` as typeof Box;

const SectionLabel = ({ children }: { children: string }) => (
  <Text
    size="xs"
    tt="uppercase"
    ff="monospace"
    c="dimmed"
    fw={600}
    mb={6}
    style={{ letterSpacing: '0.08em', fontSize: 10 }}
  >
    {children}
  </Text>
);

function buildMonthOptions(now: Date): Array<{ year: number; month: number; disabled: boolean }> {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - MAX_WINDOW_DAYS);
  const options: Array<{ year: number; month: number; disabled: boolean }> = [];
  for (let i = 12; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    options.push({ year: d.getFullYear(), month: d.getMonth() + 1, disabled: monthEnd < cutoff });
  }
  return options;
}

function buildQuarterOptions(now: Date): Array<{ year: number; quarter: 1 | 2 | 3 | 4; disabled: boolean }> {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - MAX_WINDOW_DAYS);
  const options: Array<{ year: number; quarter: 1 | 2 | 3 | 4; disabled: boolean }> = [];
  for (let y = now.getFullYear() - 1; y <= now.getFullYear(); y++) {
    for (let q = 1; q <= 4; q++) {
      const qStart = new Date(y, (q - 1) * 3, 1);
      const qEnd = new Date(y, q * 3, 0);
      options.push({
        year: y,
        quarter: q as 1 | 2 | 3 | 4,
        disabled: qStart > now || qEnd < cutoff,
      });
    }
  }
  return options;
}

export function TimeframePicker(): JSX.Element {
  const { timeframe, setTimeframe, label } = useTimeframe();
  const [open, setOpen] = useState(false);
  const [customRange, setCustomRange] = useState<[Date | null, Date | null]>([null, null]);

  const now = new Date();
  const minDate = new Date(now);
  minDate.setDate(minDate.getDate() - MAX_WINDOW_DAYS);

  const monthOptions = buildMonthOptions(now);
  const quarterOptions = buildQuarterOptions(now);

  const rangeExceedsMax =
    customRange[0] != null &&
    customRange[1] != null &&
    windowSpanDays(customRange[0], customRange[1]) > MAX_WINDOW_DAYS;

  function applyPreset(preset: PresetId) {
    void setTimeframe({ kind: 'preset', preset });
    setOpen(false);
  }

  function applyMonth(year: number, month: number) {
    void setTimeframe({ kind: 'month', year, month });
    setOpen(false);
  }

  function applyQuarter(year: number, quarter: 1 | 2 | 3 | 4) {
    void setTimeframe({ kind: 'quarter', year, quarter });
    setOpen(false);
  }

  function applyCustom(range: [Date | null, Date | null]) {
    setCustomRange(range);
    if (range[0] && range[1] && windowSpanDays(range[0], range[1]) <= MAX_WINDOW_DAYS) {
      void setTimeframe({
        kind: 'custom',
        from: toIsoDateKey(range[0]),
        to: toIsoDateKey(range[1]),
      });
    }
  }

  function reset() {
    void setTimeframe({ kind: 'preset', preset: 'last-year' });
    setOpen(false);
  }

  const isPresetActive = (p: PresetId) => timeframe.kind === 'preset' && timeframe.preset === p;
  const isMonthActive = (y: number, m: number) => timeframe.kind === 'month' && timeframe.year === y && timeframe.month === m;
  const isQuarterActive = (y: number, q: number) => timeframe.kind === 'quarter' && timeframe.year === y && timeframe.quarter === q;

  const customSectionLabel =
    timeframe.kind === 'custom' ? `custom range · ${label}` : 'custom range';
  const isDefault = timeframe.kind === 'preset' && timeframe.preset === 'last-year';

  return (
    <Popover
      opened={open}
      onChange={setOpen}
      position="bottom-end"
      shadow="xl"
      radius="md"
      withinPortal
    >
      <Popover.Target>
        <Pill
          data-active={open || undefined}
          onClick={() => setOpen((o) => !o)}
          aria-label={`dashboard timeframe, currently ${label}`}
          aria-expanded={open}
        >
          <Text component="span" c="dimmed" size="xs" ff="monospace" fw={500}>
            window ·
          </Text>
          <Text component="span" size="xs" ff="monospace" fw={600}>
            {label}
          </Text>
          <ChevronDownIcon size={12} />
        </Pill>
      </Popover.Target>

      <Popover.Dropdown
        p={14}
        style={{
          width: 640,
          maxWidth: '100vw',
          background: 'var(--gi-bg-overlay)',
          border: '1px solid var(--gi-border-default)',
        }}
      >
        <Group gap={0} align="stretch" wrap="nowrap">
          {/* Left: presets */}
          <Stack
            gap={2}
            style={{
              width: 190,
              minWidth: 190,
              borderRight: '1px solid var(--gi-border-default)',
              paddingRight: 12,
              marginRight: 14,
            }}
          >
            <Text
              size="xs"
              tt="uppercase"
              ff="monospace"
              c="dimmed"
              fw={600}
              mb={6}
              style={{ letterSpacing: '0.08em', fontSize: 10 }}
            >
              presets
            </Text>
            {PRESETS.map((p) => (
              <PresetBtn
                key={p}
                data-selected={isPresetActive(p) || undefined}
                onClick={() => applyPreset(p)}
              >
                <span>{PRESET_LABELS[p]}</span>
                <Text component="span" style={{ fontSize: 10 }} ff="monospace" c="dimmed">
                  {PRESET_SPAN_TAGS[p]}
                </Text>
              </PresetBtn>
            ))}
          </Stack>

          {/* Right: month / quarter / custom */}
          <Stack gap={12} style={{ flex: 1, minWidth: 0 }}>
            {/* Specific month */}
            <Box>
              <SectionLabel>specific month</SectionLabel>
              <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
                {monthOptions.map(({ year, month, disabled }) => (
                  <GridBtn
                    key={`${year}-${month}`}
                    data-selected={isMonthActive(year, month) || undefined}
                    data-disabled={disabled || undefined}
                    onClick={() => { if (!disabled) applyMonth(year, month); }}
                  >
                    {MONTH_ABBR[month - 1]} &apos;{String(year).slice(2)}
                  </GridBtn>
                ))}
              </Box>
            </Box>

            {/* Specific quarter */}
            <Box>
              <SectionLabel>specific quarter</SectionLabel>
              <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {quarterOptions.map(({ year, quarter, disabled }) => (
                  <GridBtn
                    key={`${year}-q${quarter}`}
                    data-selected={isQuarterActive(year, quarter) || undefined}
                    data-disabled={disabled || undefined}
                    onClick={() => { if (!disabled) applyQuarter(year, quarter); }}
                  >
                    q{quarter} &apos;{String(year).slice(2)}
                  </GridBtn>
                ))}
              </Box>
            </Box>

            {/* Custom range */}
            <Box>
              <SectionLabel>{customSectionLabel}</SectionLabel>
              <CalendarBox>
                <DatePicker
                  type="range"
                  value={customRange}
                  onChange={(range) => applyCustom(range as [Date | null, Date | null])}
                  minDate={minDate}
                  maxDate={now}
                  size="xs"
                  withCellSpacing={false}
                  styles={{
                    calendarHeader: { minHeight: 'unset', marginBottom: 6 },
                    calendarHeaderLevel: { fontSize: 11 },
                    calendarHeaderControl: { width: 20, height: 20 },
                    weekday: { fontSize: 9, width: 28, padding: '4px 0' },
                    day: { width: 28, height: 24, fontSize: 11, borderRadius: 4 },
                  }}
                />
              </CalendarBox>
              {rangeExceedsMax && (
                <Hint>max window is a year. anything longer is just a heatmap.</Hint>
              )}
            </Box>

            {/* Footer */}
            <Group
              justify="space-between"
              align="center"
              pt={10}
              style={{ borderTop: '1px solid var(--gi-border-muted)' }}
            >
              <Button
                variant="subtle"
                size="compact-xs"
                ff="monospace"
                onClick={reset}
                disabled={isDefault}
              >
                back to last 12 months
              </Button>
            </Group>
          </Stack>
        </Group>
      </Popover.Dropdown>
    </Popover>
  );
}
