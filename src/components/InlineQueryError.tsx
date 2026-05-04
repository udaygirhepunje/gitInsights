import { Alert, Anchor, Button, Group, Stack, Text } from '@mantine/core';

import { classifyError, type GitHubErrorKind } from '../api/errors';

type Props = {
  error: unknown;
  onRetry?: () => void;
};

function copyFor(info: GitHubErrorKind): { title: string; body: string } {
  switch (info.kind) {
    case 'rate-limit':
      return {
        title: 'github rate-limited us',
        body: info.resetAt
          ? `resets at ${info.resetAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. what you already see here stays until then.`
          : 'hang tight. try again in a bit.',
      };
    case 'sso-required':
      return {
        title: 'org SSO needed',
        body: 'a workplace org wants you to approve this app on github again. link below, then retry.',
      };
    case 'unauthorized':
      return {
        title: 'github logged you out',
        body: 'log back in to keep going.',
      };
    case 'not-found':
      return {
        title: "couldn't find that",
        body: 'either it does not exist or your token can not see it.',
      };
    case 'network':
      return {
        title: 'network blip',
        body: 'no connection to github. check your wifi and retry.',
      };
    case 'server':
      return {
        title: 'github is having a moment',
        body: `${info.status} from github. usually transient — retry.`,
      };
    case 'unknown':
    default:
      return {
        title: 'something went sideways',
        body: info.kind === 'unknown' ? info.message : 'unexpected error.',
      };
  }
}

export function InlineQueryError({ error, onRetry }: Props): JSX.Element {
  const info = classifyError(error);
  const { title, body } = copyFor(info);

  return (
    <Alert color="primerRed" variant="light" title={title} role="alert">
      <Stack gap="xs">
        <Text size="sm">{body}</Text>
        {info.kind === 'sso-required' && info.ssoUrl && (
          <Anchor href={info.ssoUrl} target="_blank" rel="noreferrer noopener" size="sm">
            authorize on github →
          </Anchor>
        )}
        {onRetry && (
          <Group>
            <Button size="xs" variant="subtle" color="primerBlue" onClick={onRetry}>
              retry
            </Button>
          </Group>
        )}
      </Stack>
    </Alert>
  );
}
