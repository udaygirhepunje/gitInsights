import { Box, Group, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import styled from 'styled-components';

// Matches `useCellAdornments` off-day fill and `ConsistencyMap` holiday wedge / violation dot.

const OFF_DAY_FILL = 'var(--mantine-color-primerYellow-4)';

const LegendMono = styled(Text)`
  font-size: 10px;
  line-height: 1.2;
  color: var(--gi-fg-muted);
  font-family: var(--gi-mono, ui-monospace, monospace);
  text-transform: lowercase;
` as typeof Text;

const Swatch = styled(Box)`
  width: 11px;
  height: 11px;
  border-radius: 2px;
  flex-shrink: 0;
  position: relative;
` as typeof Box;

const ActivitySwatch = styled(Swatch)<{ $level: 0 | 1 | 2 | 3 | 4 }>`
  background: var(--gi-heatmap-${({ $level }) => $level});
`;

const PtoSwatch = styled(Swatch)`
  background: ${OFF_DAY_FILL};
`;

const NonWorkdaySwatch = styled(Swatch)`
  background: var(--gi-heatmap-non-workday);
`;

const HolidaySwatch = styled(Swatch)`
  background: ${OFF_DAY_FILL};

  &::before {
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
  }
`;

const ViolationSwatch = styled(Swatch)`
  background: ${OFF_DAY_FILL};

  &::after {
    content: '';
    position: absolute;
    right: 0;
    bottom: 0;
    width: 5px;
    height: 5px;
    border-radius: 999px;
    background: var(--gi-heatmap-violation, var(--mantine-color-primerRed-5));
    box-shadow:
      0 0 0 2px var(--gi-bento-tile-bg);
  }
`;

function LegendItem({ swatch, label }: { swatch: ReactNode; label: string }): JSX.Element {
  return (
    <Group gap={6} wrap="nowrap" align="center">
      {swatch}
      <LegendMono component="span">{label}</LegendMono>
    </Group>
  );
}

/** Explains heatmap colors: commit intensity, PTO, public holiday marker, off-day commits. */
export function HeatmapLegend(): JSX.Element {
  return (
    <Group
      component="footer"
      gap="lg"
      wrap="wrap"
      align="center"
      aria-label="consistency map color key"
    >
      <Group gap={6} wrap="nowrap" align="center">
        <LegendMono component="span">no commits</LegendMono>
        <ActivitySwatch $level={0} />
      </Group>

      <Group gap={6} wrap="nowrap" align="center">
        <LegendMono component="span">less</LegendMono>
        <Group gap={3} wrap="nowrap">
          {([1, 2, 3, 4] as const).map((lvl) => (
            <ActivitySwatch key={lvl} $level={lvl} />
          ))}
        </Group>
        <LegendMono component="span">more</LegendMono>
      </Group>

      <LegendItem swatch={<NonWorkdaySwatch />} label="non-working day" />
      <LegendItem swatch={<PtoSwatch />} label="pto" />
      <LegendItem swatch={<HolidaySwatch />} label="public holiday" />
      <LegendItem swatch={<ViolationSwatch />} label="pto violation" />
    </Group>
  );
}
