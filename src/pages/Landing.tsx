import {
  Alert,
  Anchor,
  Box,
  Button,
  Divider,
  Group,
  List,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  useMantineTheme,
} from '@mantine/core';
import {
  AppsIcon,
  CalendarIcon,
  FlameIcon,
  LockIcon,
  MarkGithubIcon,
  PulseIcon,
  RepoIcon,
  SyncIcon,
  type Icon,
} from '@primer/octicons-react';
import { useCallback, useState, type CSSProperties, type MouseEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import styled from 'styled-components';

import { MetricHelpTip, TILE_HELP } from '../components/Bento';
import { metricMonoStyle } from '../components/Bento/tiles/metricMonoStyle';
import { useAuth } from '../hooks/useAuth';

const SCOPES: ReadonlyArray<{ name: string; rationale: string }> = [
  {
    name: 'read:user',
    rationale: 'your name, avatar, when you joined.',
  },
  {
    name: 'user:email',
    rationale: 'primary email so we know which commits are yours.',
  },
  {
    name: 'repo',
    rationale:
      'the work happens in private repos. read-only commits, diffs, metadata — nothing leaves your browser.',
  },
  {
    name: 'read:org',
    rationale: 'so private contributions count toward your year.',
  },
];

const LANDING_FEATURES: ReadonlyArray<{ title: string; body: string; icon: Icon }> = [
  {
    title: 'public + private, one surface',
    body: 'if you can read it on github, it can show up here. no split between “green squares” and the rest of your work.',
    icon: RepoIcon,
  },
  {
    title: 'bento + consistency map',
    body: 'a grid of tiles you actually use — including a 53-week / 7-day view of where your commits land.',
    icon: AppsIcon,
  },
  {
    title: 'commit momentum',
    body: 'a rolling 365-day score from your non-merge commits, weighted so recent work counts more — not a standup scoreboard.',
    icon: FlameIcon,
  },
  {
    title: 'wlb, said plainly',
    body: 'late nights, weekends, streaks: we say it straight. the tone matches the rest of the app. log off is on the table.',
    icon: PulseIcon,
  },
  {
    title: 'pto, holidays, off-days',
    body: 'mark time off, pull public holidays, tweak when life didn’t match the calendar. one “off-day” model drives the math.',
    icon: CalendarIcon,
  },
  {
    title: 'optional cross-device sync',
    body: 'if you want, settings can back up to a private gist in your own github account. opt-in, revocable, never a requirement.',
    icon: SyncIcon,
  },
];

const LANDING_STEPS: ReadonlyArray<{ step: string; title: string; body: string }> = [
  {
    step: '1',
    title: 'sign in with github',
    body: 'standard oauth. the scopes on this page are the whole ask — read-only, no repo writes.',
  },
  {
    step: '2',
    title: 'fetch, then stay on this device',
    body: 'we call github with your token; answers stay on this machine between visits. your token never hits our deploy beyond the one-time code exchange (see next).',
  },
  {
    step: '3',
    title: 'all the heavy lifting runs here',
    body: 'rollups, charts, the map — in your browser. a small serverless endpoint only swaps the oauth `code` for a token. it doesn’t host your data.',
  },
];

const TRUST_BULLETS: ReadonlyArray<string> = [
  'single user: no org rollups, no “team” view, no manager mode.',
  'read-only on github’s api — we don’t open issues, push commits, or edit anything.',
  'what we pull from github for the dashboard stays on this profile on this device unless you turn on gist sync (still your gist).',
];

const PreviewStack = styled(Box)`
  position: relative;
  height: clamp(360px, 36vw, 440px);
  width: 100%;
  max-width: min(400px, 100%);
  margin-inline: auto;

  @media (min-width: 62em) {
    margin-inline: auto 0;
    max-width: min(400px, 34vw);
  }
` as typeof Box;

const PreviewCard = styled(Paper)`
  position: absolute;
  padding: 18px;
  border-radius: 12px;
  box-shadow: var(--mantine-shadow-md);
  transition:
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 220ms ease;
  cursor: default;

  &:hover {
    transform: translateY(-4px) rotate(0deg) scale(1.02) !important;
    box-shadow: var(--mantine-shadow-lg);
    z-index: 4;
  }
` as typeof Paper;

const TileTitle = styled(Text)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  font-size: 12px;
  font-weight: 600;
  color: var(--mantine-color-dimmed);
  text-transform: lowercase;
  letter-spacing: 0.04em;
  font-family: var(--mantine-font-family-monospace);
  margin-bottom: 12px;
` as typeof Text;

/** OAuth scope chip — matches `docs/mocks/index.html` `.scope-list code` (inset + mono + accent). */
const ScopeTag = styled(Box)`
  display: inline-block;
  width: fit-content;
  max-width: 100%;
  padding: 2px 6px;
  border-radius: 5px;
  font-family: var(--mantine-font-family-monospace);
  font-size: 10px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.02em;
  white-space: nowrap;
  color: var(--mantine-color-primerBlue-2);
  background-color: color-mix(in srgb, var(--mantine-color-body) 58%, black);
  border: 1px solid var(--gi-border-muted);
  transition:
    border-color 140ms ease,
    background-color 140ms ease,
    box-shadow 140ms ease;

  &:hover {
    border-color: color-mix(in srgb, var(--gi-accent-fg) 55%, var(--gi-border-muted));
    background-color: color-mix(in srgb, var(--mantine-color-body) 52%, black);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--gi-accent-fg) 18%, transparent);
  }

  :where(html[data-mantine-color-scheme='light']) & {
    color: var(--mantine-color-primerBlue-6);
    background-color: var(--mantine-color-default-hover);
    border-color: var(--mantine-color-default-border);
  }

  :where(html[data-mantine-color-scheme='light']) &:hover {
    border-color: var(--mantine-color-primerBlue-4);
    background-color: var(--mantine-color-body);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--mantine-color-primerBlue-4) 22%, transparent);
  }
` as typeof Box;

const LandingRoot = styled(Box)`
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  align-self: stretch;
  box-sizing: border-box;
  width: 100vw;
  max-width: 100vw;
  margin-inline: calc(50% - 50vw);
  min-height: calc(100dvh - 56px);
  background-color: var(--mantine-color-body);
` as typeof Box;

const HeroGrid = styled(Box)`
  display: grid;
  gap: clamp(1.75rem, 4vw, 3rem);
  align-items: center;
  grid-template-columns: 1fr;

  @media (min-width: 62em) {
    grid-template-columns: minmax(0, 1fr) minmax(260px, 0.82fr);
  }
` as typeof Box;

const heights = [30, 55, 70, 60, 80, 90, 75, 95, 65, 78, 88, 100];

function LandingPreview({ blueBar }: { blueBar: string }): JSX.Element {
  return (
    <PreviewStack>
      <PreviewCard
        className="gi-landing-card"
        shadow="sm"
        withBorder
        style={{
          top: 0,
          right: 0,
          width: 'min(300px, 92%)',
          transform: 'rotate(0deg)',
        }}
      >
        <TileTitle component="div">
          <span style={{ minWidth: 0 }}>commit momentum · 365d</span>
          <MetricHelpTip
            ariaLabel="about commit momentum"
            body={TILE_HELP.commitMomentum}
          />
        </TileTitle>
        <Text fz={36} fw={700} lh={1} style={{ ...metricMonoStyle, letterSpacing: '-0.03em' }}>
          12,847
        </Text>
        <Group gap={4} align="flex-end" mt={14} wrap="nowrap" style={{ height: 36 }}>
          {heights.map((pct, i) => (
            <Box
              key={i}
              className="gi-landing-spark-bar"
              style={{
                height: `${pct}%`,
                backgroundColor: blueBar,
                animationDelay: `${i * 45}ms`,
              }}
            />
          ))}
        </Group>
      </PreviewCard>

      <PreviewCard
        className="gi-landing-card"
        shadow="sm"
        withBorder
        style={{
          top: 120,
          left: 0,
          width: 'min(280px, 88%)',
          transform: 'rotate(-3deg)',
        }}
      >
        <TileTitle component="div">
          <span style={{ minWidth: 0 }}>weekly coding days</span>
          <MetricHelpTip
            ariaLabel="about weekly coding days"
            body={TILE_HELP.weeklyCodingDays}
          />
        </TileTitle>
        <Group align="baseline" gap={6} wrap="nowrap">
          <Text fz={36} fw={700} style={{ ...metricMonoStyle, letterSpacing: '-0.02em' }}>
            4
          </Text>
          <Text fz={18} c="dimmed" style={metricMonoStyle}>
            / 5
          </Text>
        </Group>
        <Text size="xs" c="dimmed" mt={6}>
          mon was pto. denominator adjusted.
        </Text>
      </PreviewCard>

      <PreviewCard
        className="gi-landing-card"
        shadow="sm"
        withBorder
        style={{
          bottom: 0,
          right: 'clamp(0px, 4vw, 40px)',
          width: 'min(300px, 94%)',
          transform: 'rotate(2deg)',
        }}
      >
        <TileTitle component="div">
          <span style={{ minWidth: 0 }}>wlb audit · 365d</span>
          <MetricHelpTip ariaLabel="about wlb audit" body={TILE_HELP.wlbAudit} />
        </TileTitle>
        <Group align="flex-end" gap={10} wrap="nowrap" mt={6}>
          <Text fz={24} fw={700} style={metricMonoStyle}>
            11
          </Text>
          <Text size="xs" c="dimmed" pb={4} style={{ maxWidth: 140 }}>
            nights past 22:00
          </Text>
        </Group>
        <Text size="sm" c="orange" mt={10} fw={500}>
          that&apos;s a lot. log off.
        </Text>
      </PreviewCard>
    </PreviewStack>
  );
}

export function LandingPage(): JSX.Element {
  const theme = useMantineTheme();
  const { status, login } = useAuth();
  const [ptr, setPtr] = useState({ x: 52, y: 36 });

  const onHeroPointer = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPtr({
      x: ((e.clientX - r.left) / Math.max(r.width, 1)) * 100,
      y: ((e.clientY - r.top) / Math.max(r.height, 1)) * 100,
    });
  }, []);

  const onHeroLeave = useCallback(() => {
    setPtr({ x: 58, y: 32 });
  }, []);

  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />;
  }

  const isBooting = status === 'validating';
  const envMissing =
    !import.meta.env.VITE_GITHUB_CLIENT_ID || !import.meta.env.VITE_OAUTH_REDIRECT_URI;

  const blueBar = theme.colors.primerBlue![4];
  const greenEmphasis = theme.colors.primerGreen![4];
  const blueEmphasis = theme.colors.primerBlue![3];

  const gradientDashboard: CSSProperties = {
    backgroundImage: `linear-gradient(90deg, ${greenEmphasis}, ${blueEmphasis})`,
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
  };

  const dotLayer: CSSProperties = {
    position: 'absolute',
    inset: 0,
    zIndex: 0,
    pointerEvents: 'none',
    opacity: 0.38,
    backgroundImage: `radial-gradient(
      circle,
      color-mix(in srgb, var(--mantine-color-default-border) 68%, transparent) 1px,
      transparent 1px
    )`,
    backgroundSize: '22px 22px',
  };

  const meshLayer: CSSProperties = {
    position: 'absolute',
    inset: 0,
    zIndex: 1,
    pointerEvents: 'none',
    opacity: 0.52,
    background: `
      radial-gradient(
        ellipse 85% 120% at 0% 50%,
        color-mix(in srgb, var(--mantine-color-primerBlue-4) 14%, transparent),
        transparent 50%
      ),
      radial-gradient(
        ellipse 85% 120% at 100% 50%,
        color-mix(in srgb, var(--mantine-color-primerPurple-4) 12%, transparent),
        transparent 50%
      ),
      radial-gradient(
        ellipse 200% 110% at 10% 12%,
        color-mix(in srgb, var(--mantine-color-primerGreen-4) 18%, transparent),
        transparent 58%
      ),
      radial-gradient(
        ellipse 200% 110% at 90% 15%,
        color-mix(in srgb, var(--mantine-color-primerBlue-4) 16%, transparent),
        transparent 55%
      ),
      radial-gradient(
        ellipse 180% 100% at 50% 92%,
        color-mix(in srgb, var(--mantine-color-primerPurple-4) 14%, transparent),
        transparent 52%
      ),
      radial-gradient(
        ellipse 120% 80% at 50% 38%,
        color-mix(in srgb, var(--mantine-color-primerBlue-3) 9%, transparent),
        transparent 62%
      )
    `,
  };

  const pointerLayer: CSSProperties = {
    position: 'absolute',
    inset: 0,
    zIndex: 2,
    pointerEvents: 'none',
    background: `
      radial-gradient(
        min(960px, 110vw) circle at ${ptr.x}% ${ptr.y}%,
        color-mix(in srgb, ${blueBar} 22%, transparent),
        transparent 44%
      ),
      radial-gradient(
        min(720px, 90vw) circle at ${ptr.x}% ${ptr.y}%,
        color-mix(in srgb, ${greenEmphasis} 12%, transparent),
        transparent 48%
      )
    `,
  };

  return (
    <LandingRoot onMouseMove={onHeroPointer} onMouseLeave={onHeroLeave}>
      <Box aria-hidden style={dotLayer} />
      <Box aria-hidden style={meshLayer} />
      <Box aria-hidden style={pointerLayer} />

      <Box
        pos="relative"
        style={{ zIndex: 3 }}
        mx="auto"
        maw={1240}
        px={{ base: 'md', xs: 'lg', sm: 'xl', lg: 40, xl: 48 }}
        py={{ base: 'xl', sm: 40, lg: 48 }}
      >
        <HeroGrid>
          <Stack gap="lg" maw={600}>
            <div>
              <Text
                tt="uppercase"
                size="xs"
                fw={600}
                ff="monospace"
                mb="md"
                c="primerBlue"
                style={{ letterSpacing: '0.06em' }}
              >
                your commits, your story.
              </Text>
              <Title
                order={1}
                fz={{ base: 34, sm: 44, md: 56 }}
                lh={1.06}
                fw={700}
                style={{ letterSpacing: '-0.03em' }}
              >
                not your boss&apos;s
                <br />
                <Box component="span" style={gradientDashboard}>
                  dashboard.
                </Box>
              </Title>
              <Text c="dimmed" fz="lg" mt="lg" maw={520}>
                zero-server developer identity. oauth into github, render your private + public
                history in one bento. all compute happens in your browser. nothing leaves it.
              </Text>
            </div>

            <Group gap="md" align="center" wrap="wrap">
              <Button
                size="lg"
                color="primerGreen"
                leftSection={<MarkGithubIcon size={20} />}
                onClick={() => login()}
                disabled={isBooting || envMissing}
                loading={isBooting}
              >
                log in with github
              </Button>
              <Text size="sm" c="dimmed">
                read-only. no servers.
              </Text>
            </Group>

            {isBooting && (
              <Text size="sm" c="dimmed">
                <Loader size="xs" type="dots" mr="xs" />
                checking your existing session…
              </Text>
            )}
            {envMissing && (
              <Alert color="primerYellow" variant="light" title="oauth not configured">
                set <code>VITE_GITHUB_CLIENT_ID</code> and <code>VITE_OAUTH_REDIRECT_URI</code> in{' '}
                <code>.env.local</code>, then restart <code>npm run dev</code>. see{' '}
                <code>.env.example</code>.
              </Alert>
            )}

            <Paper withBorder p="lg" radius="md" bg="var(--gi-bg-muted)">
              <Title order={3} size="sm" mb={4}>
                what we ask github for, and why.
              </Title>
              <Text size="xs" c="dimmed" mb="md">
                no surprises. no upsells. each scope earns its keep.
              </Text>
              <Stack gap="sm" component="ul" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {SCOPES.map((scope) => (
                  <Box
                    key={scope.name}
                    component="li"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, max-content) minmax(0, 1fr)',
                      columnGap: '0.75rem',
                      rowGap: 2,
                      alignItems: 'start',
                    }}
                  >
                    <ScopeTag
                      component="span"
                      style={{ marginTop: 1, flexShrink: 0 }}
                    >
                      {scope.name}
                    </ScopeTag>
                    <Text
                      size="xs"
                      c="dimmed"
                      lh={1.5}
                      style={{ minWidth: 0, wordBreak: 'break-word' }}
                    >
                      {scope.rationale}
                    </Text>
                  </Box>
                ))}
              </Stack>
              <Text fz={10} c="dimmed" mt="md" lh={1.55} style={{ maxWidth: '100%' }}>
                github&rsquo;s <strong>repo</strong> blurb is the same for every app: it has to
                list <em>read and write</em> and a pile of other abilities because that is
                the maximum a <code>repo</code> token can be used for on github&rsquo;s
                side. that screen is the ceiling, not a checklist. here we only use read
                calls in your tab — commits, diffs, the metadata the tiles need. we do not
                use your token to push code, edit settings, or manage orgs.{' '}
                <Anchor
                  component={Link}
                  to="/privacy#github-repo-scope"
                  c="primerBlue"
                  fw={500}
                  underline="always"
                  inherit
                  fz={10}
                >
                  more on the privacy page
                </Anchor>
                .
              </Text>
              <Text size="xs" c="dimmed" mt="md">
                you can revoke gitInsights anytime from{' '}
                <Anchor
                  href="https://github.com/settings/applications"
                  target="_blank"
                  rel="noreferrer"
                  underline="always"
                >
                  github → settings → applications
                </Anchor>
                .
              </Text>
            </Paper>
          </Stack>

          <Box aria-hidden="true" w="100%">
            <LandingPreview blueBar={blueBar} />
          </Box>
        </HeroGrid>
      </Box>

      <Box pos="relative" style={{ zIndex: 3 }} w="100%">
        <Box mx="auto" maw={1240} px={{ base: 'md', xs: 'lg', sm: 'xl', lg: 40, xl: 48 }}>
          <Divider />
        </Box>

        <Box
          component="section"
          aria-labelledby="landing-features-title"
          mx="auto"
          maw={1240}
          px={{ base: 'md', xs: 'lg', sm: 'xl', lg: 40, xl: 48 }}
          py={{ base: 36, sm: 44, lg: 48 }}
        >
          <Stack gap="lg">
            <div>
              <Text
                tt="uppercase"
                size="xs"
                fw={600}
                ff="monospace"
                mb="sm"
                c="primerBlue"
                style={{ letterSpacing: '0.06em' }}
              >
                the bento
              </Text>
              <Title id="landing-features-title" order={2} size="h3" style={{ letterSpacing: '-0.02em' }}>
                what you actually get
              </Title>
              <Text c="dimmed" mt="sm" maw={640}>
                tiles, maps, and sums — written for you, not a slide deck. everything below is the same app you land on
                after login.
              </Text>
            </div>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
              {LANDING_FEATURES.map((f) => {
                const FeatureIcon = f.icon;
                return (
                  <Paper
                    key={f.title}
                    p="md"
                    radius="md"
                    withBorder
                    style={{ backgroundColor: 'var(--gi-bg-muted)' }}
                  >
                    <Group align="flex-start" gap="md" wrap="nowrap">
                      <ThemeIcon
                        size={40}
                        radius="md"
                        variant="light"
                        color="primerBlue"
                        aria-hidden
                        style={{ flexShrink: 0 }}
                      >
                        <FeatureIcon size={20} />
                      </ThemeIcon>
                      <Stack gap={6} style={{ minWidth: 0 }}>
                        <Text fw={600} size="sm" style={{ letterSpacing: '-0.01em' }}>
                          {f.title}
                        </Text>
                        <Text size="sm" c="dimmed" lh={1.55}>
                          {f.body}
                        </Text>
                      </Stack>
                    </Group>
                  </Paper>
                );
              })}
            </SimpleGrid>
          </Stack>
        </Box>

        <Box
          component="section"
          aria-labelledby="landing-how-title"
          py={{ base: 36, sm: 44, lg: 48 }}
          style={{ backgroundColor: 'var(--gi-bg-muted)' }}
        >
          <Box mx="auto" maw={1240} px={{ base: 'md', xs: 'lg', sm: 'xl', lg: 40, xl: 48 }}>
            <Stack gap="lg">
              <div>
                <Text
                  tt="uppercase"
                  size="xs"
                  fw={600}
                  ff="monospace"
                  mb="sm"
                  c="primerBlue"
                  style={{ letterSpacing: '0.06em' }}
                >
                  no mystery architecture
                </Text>
                <Title id="landing-how-title" order={2} size="h3" style={{ letterSpacing: '-0.02em' }}>
                  how it works
                </Title>
                <Text c="dimmed" mt="sm" maw={640}>
                  three steps. the only thing that looks like a “server” is the oauth token exchange; your dashboard
                  data doesn’t live there.
                </Text>
              </div>
              <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
                {LANDING_STEPS.map((s) => (
                  <Paper
                    key={s.step}
                    p="lg"
                    radius="md"
                    withBorder
                    style={{ backgroundColor: 'var(--mantine-color-body)' }}
                  >
                    <Text
                      ff="monospace"
                      size="sm"
                      fw={700}
                      c="dimmed"
                      mb="md"
                      style={{ letterSpacing: '0.08em' }}
                    >
                      {s.step}
                    </Text>
                    <Text fw={600} size="sm" mb="xs" style={{ letterSpacing: '-0.01em' }}>
                      {s.title}
                    </Text>
                    <Text size="sm" c="dimmed" lh={1.55}>
                      {s.body}
                    </Text>
                  </Paper>
                ))}
              </SimpleGrid>
            </Stack>
          </Box>
        </Box>

        <Box
          component="section"
          aria-labelledby="landing-trust-title"
          mx="auto"
          maw={1240}
          px={{ base: 'md', xs: 'lg', sm: 'xl', lg: 40, xl: 48 }}
          py={{ base: 36, sm: 44, lg: 48 }}
        >
          <Group align="flex-start" wrap="wrap" justify="space-between" gap="xl">
            <Stack gap="md" maw={560} style={{ flex: '1 1 280px' }}>
              <div>
                <Text
                  tt="uppercase"
                  size="xs"
                  fw={600}
                  ff="monospace"
                  mb="sm"
                  c="primerBlue"
                  style={{ letterSpacing: '0.06em' }}
                >
                  trust
                </Text>
                <Title id="landing-trust-title" order={2} size="h3" style={{ letterSpacing: '-0.02em' }}>
                  your data stays yours
                </Title>
                <Text c="dimmed" mt="sm">
                  if this doesn’t match how you work, close the tab. storage, tokens, and
                  the long note about the <code>repo</code> scope (what github shows when you
                  authorize) are on the{' '}
                  <Anchor
                    component={Link}
                    to="/privacy#github-repo-scope"
                    c="primerBlue"
                    underline="always"
                    fw={500}
                  >
                    privacy page
                  </Anchor>
                  . no legalese wall, just what we keep and what we do not.
                </Text>
              </div>
              <List
                styles={{ item: { lineHeight: 1.6 }, root: { paddingLeft: 0 } }}
                c="dimmed"
                size="sm"
                spacing="xs"
              >
                {TRUST_BULLETS.map((line) => (
                  <List.Item key={line}>{line}</List.Item>
                ))}
              </List>
            </Stack>
            <Paper
              p="lg"
              radius="md"
              maw={400}
              w="100%"
              withBorder
              style={{ flex: '0 1 360px', backgroundColor: 'var(--gi-bg-muted)' }}
            >
              <Text fw={600} size="sm" mb="xs" style={{ letterSpacing: '-0.01em' }}>
                the contract in one line
              </Text>
              <Text size="sm" c="dimmed" lh={1.55} mb="md">
                we’re not building a people-analytics product. you’re the audience for every number on the screen.
              </Text>
              <ThemeIcon size="lg" variant="light" color="gray" radius="md" aria-hidden>
                <LockIcon size={20} />
              </ThemeIcon>
            </Paper>
          </Group>
        </Box>

        <Box
          component="section"
          aria-labelledby="landing-cta-title"
          py={{ base: 40, sm: 48, lg: 56 }}
          style={{ backgroundColor: 'var(--gi-bg-muted)' }}
        >
          <Box mx="auto" maw={1240} px={{ base: 'md', xs: 'lg', sm: 'xl', lg: 40, xl: 48 }}>
            <Stack align="flex-start" gap="lg">
              <div>
                <Text
                  tt="uppercase"
                  size="xs"
                  fw={600}
                  ff="monospace"
                  mb="sm"
                  c="primerBlue"
                  style={{ letterSpacing: '0.06em' }}
                >
                  who it’s for
                </Text>
                <Title id="landing-cta-title" order={2} size="h3" style={{ letterSpacing: '-0.02em' }}>
                  the main character, not the rollup
                </Title>
                <Text c="dimmed" mt="md" maw={640} lh={1.6} size="md">
                  if your real work lives in private org repos, you already know the problem: the public graph only
                  shows part of the story. gitInsights is a single sign-in, single screen — the opposite of a team
                  dashboard. if you need numbers for a slide, this isn’t it.
                </Text>
              </div>
              <Button
                size="lg"
                color="primerGreen"
                leftSection={<MarkGithubIcon size={20} />}
                onClick={() => login()}
                disabled={isBooting || envMissing}
                loading={isBooting}
              >
                log in with github
              </Button>
            </Stack>
          </Box>
        </Box>
      </Box>
    </LandingRoot>
  );
}
