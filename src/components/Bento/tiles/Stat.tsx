import { Group, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import styled from 'styled-components';

const bigBase = `
  line-height: 1;
  font-weight: 700;
  font-feature-settings: 'tnum';
  font-family: var(--gi-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  color: var(--gi-fg-default);
`;

const Big = styled(Text)`
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  ${bigBase}
` as typeof Text;

const BigHero = styled(Text)`
  font-size: clamp(2.75rem, 7vw, 4rem);
  ${bigBase}
` as typeof Text;

const StatValue = styled(Text)`
  font-family: var(--gi-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-feature-settings: 'tnum';
` as typeof Text;

export function StatNumber({
  value,
  unit,
  trailing,
  hero,
}: {
  value: ReactNode;
  unit?: ReactNode;
  trailing?: ReactNode;
  /** Renders the number at display size — use for the primary tile metric. */
  hero?: boolean;
}): JSX.Element {
  const Num = hero ? BigHero : Big;
  return (
    <Group gap="xs" align="baseline" wrap="nowrap">
      <Num>{value}</Num>
      {unit ? (
        <Text size="sm" c="dimmed">
          {unit}
        </Text>
      ) : null}
      {trailing}
    </Group>
  );
}

export function StatRow({
  label,
  value,
}: {
  label: ReactNode;
  value: ReactNode;
}): JSX.Element {
  return (
    <Group justify="space-between" wrap="nowrap" gap="md">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <StatValue size="sm" fw={600} ta="right" style={{ whiteSpace: 'nowrap' }}>
        {value}
      </StatValue>
    </Group>
  );
}

export function VerdictLine({ children }: { children: ReactNode }): JSX.Element {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed" lh={1.4}>
        {children}
      </Text>
    </Stack>
  );
}
