import {
  Alert,
  Box,
  Button,
  Card,
  Center,
  Group,
  ScrollArea,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core';
import { AlertIcon, InboxIcon, type Icon } from '@primer/octicons-react';
import type { ReactNode } from 'react';
import styled from 'styled-components';

import { MetricHelpTip } from './MetricHelpTip';

// Bento tile primitive. Every analytics tile on /dashboard renders inside one
// of these. Owns the five tile states so consumers never ship blank chrome.

export type BentoTileState = 'loading' | 'empty' | 'error' | 'loaded' | 'placeholder';

export type BentoTileProps = {
  title: string;
  /** Shown next to the title as a ? control. ReactNode from `TILE_HELP` (bullets + formula). */
  titleTooltip?: ReactNode;
  state: BentoTileState;
  children?: ReactNode;
  footer?: ReactNode;
  icon?: Icon;
  emptyMessage?: string;
  errorMessage?: string;
  onRetry?: () => void;
  area?: string;
};

const TileCard = styled(Card)`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--gi-bento-tile-bg);
  border: 1px solid var(--gi-border-muted);
` as typeof Card;

const TileBody = styled(ScrollArea)`
  flex: 1 1 auto;
  min-height: 0;
` as typeof ScrollArea;

const DEFAULT_EMPTY = 'nothing here yet. either you’re new, on PTO, or actually resting. all valid.';
const DEFAULT_ERROR = 'couldn’t load this. github blinked. try again.';

export function BentoTile({
  title,
  titleTooltip,
  state,
  children,
  footer,
  icon: IconGlyph,
  emptyMessage = DEFAULT_EMPTY,
  errorMessage = DEFAULT_ERROR,
  onRetry,
  area,
}: BentoTileProps): JSX.Element {
  return (
    <TileCard
      padding="md"
      radius="md"
      withBorder
      style={area ? { gridArea: area } : undefined}
      aria-busy={state === 'loading'}
      role="region"
      aria-label={title}
    >
      <Card.Section inheritPadding py="sm" withBorder>
        <Group justify="space-between" wrap="nowrap" align="center" gap="xs">
          <Group gap="xs" wrap="nowrap" align="center" style={{ minWidth: 0 }}>
            {IconGlyph ? (
              <Box c="dimmed" component="span" lh={0} style={{ display: 'flex' }} aria-hidden>
                <IconGlyph size={14} />
              </Box>
            ) : null}
            <Text
              component="h3"
              fz={11}
              fw={500}
              c="dimmed"
              tt="lowercase"
              lh={1.35}
              style={{
                fontFamily: 'var(--gi-mono, ui-monospace, monospace)',
                letterSpacing: '0.02em',
              }}
            >
              {title}
            </Text>
          </Group>
          {titleTooltip ? (
            <MetricHelpTip ariaLabel={`about: ${title}`} body={titleTooltip} />
          ) : null}
        </Group>
      </Card.Section>

      <TileBody type="auto" offsetScrollbars>
        <Box py="md">
          {state === 'loading' ? <LoadingBody /> : null}
          {state === 'empty' ? <EmptyBody message={emptyMessage} /> : null}
          {state === 'error' ? <ErrorBody message={errorMessage} onRetry={onRetry} /> : null}
          {state === 'placeholder' ? <PlaceholderBody /> : null}
          {state === 'loaded' ? children : null}
        </Box>
      </TileBody>

      {footer ? (
        <Card.Section inheritPadding py="sm" withBorder>
          {footer}
        </Card.Section>
      ) : null}
    </TileCard>
  );
}

function LoadingBody(): JSX.Element {
  return (
    <Stack gap="sm" aria-live="polite" aria-label="loading">
      <Skeleton height={14} width="40%" radius="sm" />
      <Skeleton height={80} radius="sm" />
      <Skeleton height={14} width="70%" radius="sm" />
    </Stack>
  );
}

function EmptyBody({ message }: { message: string }): JSX.Element {
  return (
    <Center mih={120}>
      <Stack gap="xs" align="center" maw={320} ta="center">
        <Box c="dimmed" component="span" lh={1} aria-hidden>
          <InboxIcon size={20} />
        </Box>
        <Text size="sm" c="dimmed">
          {message}
        </Text>
      </Stack>
    </Center>
  );
}

function ErrorBody({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}): JSX.Element {
  return (
    <Alert
      variant="light"
      color="primerRed"
      radius="sm"
      icon={<AlertIcon size={16} />}
      role="alert"
    >
      <Stack gap="sm">
        <Text size="sm">{message}</Text>
        {onRetry ? (
          <Group>
            <Button size="xs" variant="default" onClick={onRetry}>
              try again
            </Button>
          </Group>
        ) : null}
      </Stack>
    </Alert>
  );
}

function PlaceholderBody(): JSX.Element {
  return (
    <Center mih={120}>
      <Text size="sm" c="dimmed">
        coming soon.
      </Text>
    </Center>
  );
}
