import { Alert, Anchor, Button, Group, Stack, Text } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';

import { clearSsoRequired } from '../api/events';
import { useSsoRequired } from '../hooks/useSsoRequired';

const GITHUB_AUTHORIZED_APPS = 'https://github.com/settings/applications';

export function SsoRequiredBanner(): JSX.Element | null {
  const info = useSsoRequired();
  const queryClient = useQueryClient();

  if (!info) return null;

  const authorizeHref = info.ssoUrl ?? GITHUB_AUTHORIZED_APPS;

  const handleRetry = () => {
    clearSsoRequired();
    void queryClient.invalidateQueries();
  };

  return (
    <Alert
      color="primerOrange"
      variant="light"
      title="organization SSO needs a refresh"
      role="status"
      aria-live="polite"
    >
      <Stack gap="xs">
        <Text size="sm">
          Your personal login is still valid. An organization you use requires you to re-authorize
          SAML SSO for this OAuth app on GitHub.
        </Text>
        <Group gap="sm" wrap="wrap">
          <Anchor href={authorizeHref} target="_blank" rel="noreferrer noopener" size="sm">
            open GitHub to authorize SSO
          </Anchor>
          <Button variant="light" color="primerBlue" size="compact-xs" onClick={handleRetry}>
            retry after authorizing
          </Button>
        </Group>
      </Stack>
    </Alert>
  );
}
