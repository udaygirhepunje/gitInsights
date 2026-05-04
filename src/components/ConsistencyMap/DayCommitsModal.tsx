import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Group,
  Modal,
  Skeleton,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import {
  ClockIcon,
  GitCommitIcon,
  LinkExternalIcon,
  RepoIcon,
} from '@primer/octicons-react';
import type { FC, SVGProps } from 'react';

import type { CachedCommitDayEntry } from '../../api/commitCache';
import { useCachedCommitsForDay } from '../../hooks/useCachedCommitsForDay';
import { metricMonoStyle } from '../Bento/tiles/metricMonoStyle';

/** Octicons `IconProps` omits `style`; `<svg>` accepts size/className at runtime. */
const IconSvg = GitCommitIcon as unknown as FC<
  { size?: number } & Pick<SVGProps<SVGSVGElement>, 'style' | 'className' | 'aria-hidden'>
>;
const RepoSvg = RepoIcon as unknown as FC<
  { size?: number } & Pick<SVGProps<SVGSVGElement>, 'style' | 'className' | 'aria-hidden'>
>;
const ClockSvg = ClockIcon as unknown as FC<
  { size?: number } & Pick<SVGProps<SVGSVGElement>, 'style' | 'className' | 'aria-hidden'>
>;
const ExternalSvg = LinkExternalIcon as unknown as FC<
  { size?: number } & Pick<SVGProps<SVGSVGElement>, 'style' | 'className' | 'aria-hidden'>
>;

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

const KIND_COLORS: Record<string, string> = {
  feat: 'primerGreen',
  fix: 'primerRed',
  docs: 'primerBlue',
  chore: 'primerGray',
  refactor: 'primerPurple',
  style: 'primerPink',
  test: 'primerOrange',
  perf: 'primerYellow',
  ci: 'primerGray',
  build: 'primerGray',
  revert: 'primerRed',
};

function titleForIsoDay(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00`);
  const weekday = WEEKDAY_SHORT[date.getDay()] ?? '';
  const month = MONTH_SHORT[date.getMonth()] ?? '';
  return `${weekday}, ${month} ${date.getDate()} · ${dateKey}`;
}

function githubRepoUrl(repoFullName: string): string {
  return `https://github.com/${repoFullName}`;
}

function commitKindBadge(title: string): { label: string; color: string } {
  const t = title.trim();
  if (/^merge\b/i.test(t)) return { label: 'merge', color: 'primerPurple' };
  const match = /^(\w+)(?:\([^)]*\))?(!)?:\s*/u.exec(t);
  if (!match) return { label: 'misc', color: 'primerGray' };
  const raw = match[1]?.toLowerCase() ?? '';
  const color = KIND_COLORS[raw] ?? 'primerGray';
  return { label: raw, color };
}

/** Max visible characters for commit subject in the list (ellipsis replaces last char when truncated). */
const COMMIT_TITLE_DISPLAY_MAX = 50;

function ellipsizeCommitTitle(title: string): { text: string; truncated: boolean } {
  if (title.length <= COMMIT_TITLE_DISPLAY_MAX) return { text: title, truncated: false };
  return { text: `${title.slice(0, COMMIT_TITLE_DISPLAY_MAX - 1)}…`, truncated: true };
}

function CommitRow({ commit, isLast }: { commit: CachedCommitDayEntry; isLast?: boolean }): JSX.Element {
  const parsed = Date.parse(commit.authorDate);
  const timeOnly = Number.isNaN(parsed)
    ? commit.authorDate.slice(11, 16)
    : new Date(parsed).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      });

  const shortSha = commit.sha.slice(0, 7);
  const repoUrl = githubRepoUrl(commit.repoFullName);
  const { label: kindLabel, color: kindColor } = commitKindBadge(commit.title);
  const { text: titleShown, truncated: titleTruncated } = ellipsizeCommitTitle(commit.title);
  const badgeVariant = kindColor === 'primerGray' ? 'default' : 'light';

  const titleAnchor = (
    <Anchor
      href={commit.htmlUrl}
      target="_blank"
      rel="noreferrer"
      size="sm"
      fw={600}
      lh={1.35}
      underline="hover"
      c="primerBlue"
      style={{
        flex: 1,
        minWidth: 0,
        display: 'block',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {titleShown}
    </Anchor>
  );

  return (
    <Box
      py={6}
      px={4}
      style={{
        borderBottom: isLast
          ? undefined
          : '1px solid var(--gi-border-muted, var(--mantine-color-dark-4))',
      }}
    >
      <Group gap="sm" align="flex-start" wrap="nowrap">
        <Box
          style={{
            flexShrink: 0,
            marginTop: 2,
            color: 'var(--mantine-color-dimmed)',
            opacity: 0.85,
          }}
          aria-hidden
        >
          <IconSvg size={14} />
        </Box>

        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
          <Group gap={6} align="flex-start" wrap="nowrap" justify="space-between">
            <Group gap={6} wrap="nowrap" align="flex-start" style={{ flex: 1, minWidth: 0 }}>
              <Badge
                size="xs"
                variant={badgeVariant}
                color={kindColor}
                radius="sm"
                tt="lowercase"
                style={{
                  flexShrink: 0,
                  fontFamily: 'var(--gi-mono, ui-monospace, monospace)',
                }}
              >
                {kindLabel}
              </Badge>
              {titleTruncated ? (
                <Tooltip label={commit.title} multiline maw={360} withArrow withinPortal>
                  <Box style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>{titleAnchor}</Box>
                </Tooltip>
              ) : (
                titleAnchor
              )}
            </Group>

            <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }} align="center">
              <Group gap={3} wrap="nowrap" align="center">
                <ClockSvg size={12} style={{ opacity: 0.65 }} aria-hidden />
                <Text size="xs" c="dimmed" style={metricMonoStyle}>
                  {timeOnly}
                </Text>
              </Group>
              <ActionIcon
                component="a"
                href={commit.htmlUrl}
                target="_blank"
                rel="noreferrer"
                variant="light"
                color="primerBlue"
                size="sm"
                aria-label="open commit on GitHub"
              >
                <ExternalSvg size={14} />
              </ActionIcon>
            </Group>
          </Group>

          <Group gap={6} wrap="nowrap" align="center" style={{ minWidth: 0 }}>
            <RepoSvg size={12} style={{ flexShrink: 0, opacity: 0.65 }} aria-hidden />
            <Tooltip label={commit.repoFullName} withArrow withinPortal>
              <Anchor
                href={repoUrl}
                target="_blank"
                rel="noreferrer"
                size="xs"
                c="dimmed"
                fw={500}
                style={{
                  ...metricMonoStyle,
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {commit.repoFullName}
              </Anchor>
            </Tooltip>
            <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
              ·
            </Text>
            <Anchor
              href={commit.htmlUrl}
              target="_blank"
              rel="noreferrer"
              size="xs"
              fw={600}
              c="primerBlue"
              style={{ ...metricMonoStyle, flexShrink: 0 }}
            >
              {shortSha}
            </Anchor>
          </Group>
        </Stack>
      </Group>
    </Box>
  );
}

export type DayCommitsModalProps = {
  opened: boolean;
  /** YYYY-MM-DD */
  dateKey: string | null;
  login: string | null | undefined;
  onClose: () => void;
  /** Count from merged heatmap `byDate` for mismatch messaging. */
  expectedCount: number;
};

export function DayCommitsModal(props: DayCommitsModalProps): JSX.Element {
  const enabled = props.opened;
  const { data, isLoading, isFetching } = useCachedCommitsForDay({
    login: props.login,
    dateKey: props.dateKey,
    enabled,
  });

  const commits = data ?? [];
  const title =
    props.dateKey != null ? titleForIsoDay(props.dateKey) : '';

  const showMismatch =
    !isLoading &&
    !isFetching &&
    props.expectedCount > 0 &&
    commits.length === 0 &&
    props.dateKey != null;

  return (
    <Modal
      opened={props.opened}
      onClose={props.onClose}
      title={
        <Group gap="xs" wrap="nowrap" align="center">
          <IconSvg size={18} style={{ opacity: 0.9 }} aria-hidden />
          <Text fw={700} size="md" component="span">
            summary — {title}
          </Text>
        </Group>
      }
      size="lg"
      centered
    >
      {isLoading || isFetching ? (
        <Stack gap="xs" py="sm">
          <Skeleton height={12} radius="xs" />
          <Skeleton height={48} radius="xs" />
          <Skeleton height={48} radius="xs" />
        </Stack>
      ) : commits.length === 0 ? (
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            {props.expectedCount === 0
              ? 'no non-merge commits on this day (same as an empty heatmap cell).'
              : 'we don&apos;t have the per-commit list for this day yet.'}
          </Text>
          {showMismatch ? (
            <Text size="xs" c="primerYellow">
              The heatmap shows {props.expectedCount.toLocaleString()} commit
              {props.expectedCount === 1 ? '' : 's'}, but the detailed list hasn&apos;t been filled in yet.
              settings → account → refresh all commit data, then open this day again.
            </Text>
          ) : null}
        </Stack>
      ) : (
        <Stack gap={0}>
          <Group justify="space-between" wrap="wrap" gap="xs" pb="xs">
            <Text size="xs" c="dimmed">
              {commits.length.toLocaleString()} commit
              {commits.length === 1 ? '' : 's'}
            </Text>
            <Text size="xs" c="dimmed" style={metricMonoStyle}>
              click row or ↗ to open on GitHub
            </Text>
          </Group>
          <Box
            style={{
              maxHeight: 'min(52vh, 420px)',
              overflowY: 'auto',
              overflowX: 'hidden',
              overscrollBehavior: 'contain',
              marginInline: -4,
              paddingInline: 4,
            }}
          >
            {commits.map((c, index) => (
              <CommitRow
                key={`${c.repoFullName}:${c.sha}`}
                commit={c}
                isLast={index === commits.length - 1}
              />
            ))}
          </Box>
        </Stack>
      )}
    </Modal>
  );
}
