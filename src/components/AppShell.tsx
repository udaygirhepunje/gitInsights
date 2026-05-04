import {
  AppShell as MantineAppShell,
  Avatar,
  Box,
  Button,
  Container,
  Group,
  Menu,
  Stack,
  Text,
  useMantineTheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  Link,
  NavLink as RouterNavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { MarkGithubIcon } from '@primer/octicons-react';
import type { CSSProperties, FC, SVGProps } from 'react';
import styled from 'styled-components';

/** `@primer/octicons-react` `IconProps` omits `style`; the runtime `<svg>` still accepts it. */
const MarkGithubOcticon = MarkGithubIcon as unknown as FC<
  { size?: number } & Pick<SVGProps<SVGSVGElement>, 'style' | 'className' | 'aria-hidden'>
>;

import { useAuth } from '../hooks/useAuth';
import { useQueryCacheFreshness } from '../hooks/useQueryCacheFreshness';
import { RateLimitBanner } from './RateLimitBanner';
import { SsoRequiredBanner } from './SsoRequiredBanner';

// App chrome: brand + pill nav (sm+) + cache freshness + avatar menu; below sm,
// dashboard / profile / settings live in the avatar menu only.
//
// styled-components v6 loses the polymorphic typing of Mantine components when
// it wraps them, so we cast each `styled(...)` result back to the source
// component's type.
const HeaderInner = styled(Group)`
  height: 100%;
  padding-inline: ${({ theme }) => theme.spacing.md};
  border-bottom: 1px solid var(--gi-border-default);
` as typeof Group;

const BrandWord = styled(Text)`
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--gi-fg-default);
` as typeof Text;

function viewerInitials(login: string, name: string | null): string {
  const n = name?.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
  return login.slice(0, 2).toUpperCase();
}

/** GitHub profile `name` is usually "first … last"; split for the avatar menu header. */
function splitDisplayName(name: string | null): { first: string | null; last: string | null } {
  const n = name?.trim();
  if (!n) return { first: null, last: null };
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: null, last: null };
  if (parts.length === 1) return { first: parts[0]!, last: null };
  return { first: parts[0]!, last: parts.slice(1).join(' ') };
}

function menuNavItemStyles(active: boolean): { styles: { item: CSSProperties } } {
  return {
    styles: {
      item: {
        backgroundColor: active ? 'var(--mantine-color-default-hover)' : undefined,
        fontWeight: active ? 600 : undefined,
      },
    },
  };
}

const giFg: CSSProperties = { color: 'var(--gi-fg-default)' };

/** Mantine 7 `Button` uses `--button-color` for the label; `subtle` + `gray` resolves too faint in light. Map to Primer. */
function headerNavPillStyles(active: boolean) {
  return {
    root: {
      // Mantine: inner/label `color: var(--button-color)`; override the gray scale from variantColorResolver.
      '--button-color': 'var(--gi-fg-default)',
      '--button-hover-color': 'var(--gi-fg-default)',
      backgroundColor: active ? 'var(--gi-bg-subtle)' : undefined,
    } as CSSProperties,
    label: giFg,
  };
}

export function AppShell(): JSX.Element {
  const theme = useMantineTheme();
  const { pathname } = useLocation();
  const { status, viewer, login, logout } = useAuth();
  const navigate = useNavigate();
  const isAuthed = status === 'authenticated';
  const cacheAgo = useQueryCacheFreshness(isAuthed);
  const isSmUp = useMediaQuery(`(min-width: ${theme.breakpoints.sm})`, undefined, {
    getInitialValueInEffect: false,
  });
  /** Prefer showing menu links until we know viewport is `sm+` (avoids a blank nav tick). */
  const showNavInAvatarMenu = isSmUp !== true;

  const avatarSrc = viewer?.avatarUrl?.trim() || undefined;
  const accountNameParts = viewer ? splitDisplayName(viewer.name) : { first: null, last: null };

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const dashboardActive = pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  const profileActive =
    viewer != null && (pathname === `/u/${viewer.login}` || pathname.startsWith(`/u/${viewer.login}/`));
  const settingsActive = pathname === '/settings' || pathname.startsWith('/settings/');
  const isLanding = pathname === '/';

  return (
    <MantineAppShell
      header={{ height: 56 }}
      padding={isLanding ? 0 : 'md'}
      styles={
        isLanding
          ? {
              root: {
                minHeight: '100dvh',
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                maxWidth: '100%',
              },
              main: {
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                width: '100%',
                maxWidth: '100%',
              },
            }
          : undefined
      }
    >
      <MantineAppShell.Header>
        <HeaderInner justify="space-between" wrap="nowrap" align="center" gap="md" style={{ flexWrap: 'nowrap' }}>
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Group gap="sm" wrap="nowrap">
              <Box
                component="img"
                src={`${import.meta.env.BASE_URL}favicon.svg`}
                alt=""
                w={28}
                h={28}
                style={{ display: 'block', flexShrink: 0 }}
              />
              <BrandWord size="lg">gitInsights</BrandWord>
            </Group>
          </Link>

          {isAuthed && viewer ? (
            <>
              <Group
                justify="center"
                gap={4}
                wrap="nowrap"
                visibleFrom="sm"
                style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}
              >
                <Button
                  component={RouterNavLink}
                  to="/dashboard"
                  variant="subtle"
                  color="gray"
                  styles={headerNavPillStyles(dashboardActive)}
                  radius="xl"
                  size="compact-sm"
                  px="sm"
                >
                  dashboard
                </Button>
                <Button
                  component={RouterNavLink}
                  to={`/u/${viewer.login}`}
                  variant="subtle"
                  color="gray"
                  styles={headerNavPillStyles(profileActive)}
                  radius="xl"
                  size="compact-sm"
                  px="sm"
                >
                  profile
                </Button>
                <Button
                  component={RouterNavLink}
                  to="/settings"
                  variant="subtle"
                  color="gray"
                  styles={headerNavPillStyles(settingsActive)}
                  radius="xl"
                  size="compact-sm"
                  px="sm"
                >
                  settings
                </Button>
              </Group>

              <Group gap="sm" wrap="nowrap">
                <Group
                  gap={6}
                  px="sm"
                  py={4}
                  wrap="nowrap"
                  title={cacheAgo ? `cache · ${cacheAgo}` : 'cache status'}
                  style={{
                    border: '1px solid var(--gi-border-default)',
                    borderRadius: 9999,
                    flexShrink: 0,
                  }}
                >
                  <Box
                    w={6}
                    h={6}
                    style={{
                      borderRadius: '50%',
                      background: 'var(--gi-success-fg)',
                      flexShrink: 0,
                    }}
                  />
                  <Text size="xs" c="dimmed" visibleFrom="xs" style={{ whiteSpace: 'nowrap' }}>
                    cache · {cacheAgo ?? '—'}
                  </Text>
                </Group>

                <Menu shadow="md" width={240} position="bottom-end">
                  <Menu.Target>
                    <Avatar
                      size="md"
                      src={avatarSrc}
                      alt={`${viewer.login} avatar`}
                      styles={{
                        root: {
                          cursor: 'pointer',
                          ...(avatarSrc ? { border: '1px solid var(--gi-border-default)' } : {}),
                        },
                        placeholder: {
                          background: theme.other.avatarFallbackGradient,
                          color: 'var(--gi-fg-on-emphasis)',
                          fontSize: 11,
                          fontWeight: 700,
                        },
                      }}
                      aria-label={`${viewer.login} account menu`}
                    >
                      {viewerInitials(viewer.login, viewer.name)}
                    </Avatar>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Label px="sm" py="xs">
                      <Group gap="sm" align="stretch" wrap="nowrap">
                        <Box
                          aria-hidden
                          c="dimmed"
                          style={{
                            alignSelf: 'stretch',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            width: 36,
                            minHeight: 0,
                          }}
                        >
                          <MarkGithubOcticon
                            size={48}
                            style={{
                              height: '100%',
                              width: 'auto',
                              maxHeight: 56,
                              maxWidth: 32,
                              display: 'block',
                              flexShrink: 0,
                            }}
                          />
                        </Box>
                        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                          {accountNameParts.first && accountNameParts.last ? (
                            <>
                              <Text size="sm" fw={600} lh={1.35}>
                                {accountNameParts.first} {accountNameParts.last}
                              </Text>
                            </>
                          ) : accountNameParts.first ? (
                            <Text size="sm" fw={600} lh={1.35}>
                              {accountNameParts.first}
                            </Text>
                          ) : (
                            <Text size="sm" fw={600} lh={1.35}>
                              @{viewer.login}
                            </Text>
                          )}
                          {(accountNameParts.first ?? accountNameParts.last) && (
                            <Text size="xs" c="dimmed" lh={1.3}>
                              @{viewer.login}
                            </Text>
                          )}
                        </Stack>
                      </Group>
                    </Menu.Label>
                    <Menu.Divider />
                    {showNavInAvatarMenu ? (
                      <>
                        <Menu.Item
                          component={RouterNavLink}
                          to="/dashboard"
                          {...menuNavItemStyles(dashboardActive)}
                        >
                          dashboard
                        </Menu.Item>
                        <Menu.Item
                          component={RouterNavLink}
                          to={`/u/${viewer.login}`}
                          {...menuNavItemStyles(profileActive)}
                        >
                          profile
                        </Menu.Item>
                        <Menu.Item
                          component={RouterNavLink}
                          to="/settings"
                          {...menuNavItemStyles(settingsActive)}
                        >
                          settings
                        </Menu.Item>
                        <Menu.Divider />
                      </>
                    ) : null}
                    <Menu.Item component={Link} to="/privacy">
                      privacy policy
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Item
                      color="red"
                      onClick={() => {
                        void handleLogout();
                      }}
                    >
                      log out
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            </>
          ) : (
            <>
              <Box style={{ flex: 1 }} />
              <Group gap="sm" wrap="nowrap">
                <Button
                  component={RouterNavLink}
                  to="/privacy"
                  variant="subtle"
                  color="gray"
                  size="compact-sm"
                  styles={headerNavPillStyles(false)}
                >
                  privacy
                </Button>
                <Button size="compact-sm" color="primerBlue" onClick={() => login()}>
                  log in
                </Button>
              </Group>
            </>
          )}
        </HeaderInner>
      </MantineAppShell.Header>
      <MantineAppShell.Main>
        {isLanding ? (
          <Box
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              width: '100%',
              maxWidth: '100%',
            }}
          >
            <Stack gap={0} style={{ flex: 1, minHeight: 0, width: '100%' }}>
              <Box px="md">
                <Stack gap="sm">
                  <SsoRequiredBanner />
                  <RateLimitBanner />
                </Stack>
              </Box>
              <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, width: '100%' }}>
                <Outlet />
              </Box>
            </Stack>
          </Box>
        ) : (
          <Container size="lg" py="lg">
            <Stack gap="md">
              <SsoRequiredBanner />
              <RateLimitBanner />
              <Outlet />
            </Stack>
          </Container>
        )}
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}
