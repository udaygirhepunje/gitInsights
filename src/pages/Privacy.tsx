import { Anchor, List, Stack, Text, Title } from '@mantine/core';

const REVOKE_APPS = 'https://github.com/settings/applications';

// Spec §10: short, direct. Accurate without leading with storage API jargon.
export function PrivacyPage(): JSX.Element {
  return (
    <Stack gap="lg" maw={720}>
      <Title order={1}>privacy</Title>
      <Text>
        gitInsights is a browser app. we ask github for your commits, repos, org
        membership, and profile so the dashboard can render. read-only from
        github&apos;s side — we never post or change your code from here.
      </Text>
      <Title
        id="github-repo-scope"
        order={2}
        maw="100%"
        style={{ wordBreak: 'break-word', scrollMarginTop: '0.5rem' }}
      >
        the <code>repo</code> scope and github&rsquo;s authorization screen
      </Title>
      <Text>
        on the authorize page, github shows a long block of text for the{' '}
        <code>repo</code> scope. it is the same for every app that requests it, and
        it says <strong>read and write</strong> to public and private repository
        data — code, issues, pull requests, wikis, settings, and more. there is
        also a note that the scope can allow managing org resources (projects,
        team membership, webhooks) in some cases. that is the <em>ceiling</em> of
        what a <code>repo</code> token is allowed to do on github&rsquo;s platform, not
        a bespoke sentence about gitInsights.
      </Text>
      <Text>
        we need <code>repo</code> so the GraphQL and REST APIs can read commit
        history, file changes, and private repository metadata. this app only
        issues the read calls that power your dashboard. we do not push branches,
        open or merge pull requests, edit webhooks, change repo settings, or
        perform org administration on your behalf. the token is stored in your
        device and is not held on our static site in a way that rewrites your
        repositories.
      </Text>
      <Text>
        if you turn on cross-device settings sync, that is a <strong>separate</strong>{' '}
        <code>gist</code> scope when you opt in. it does not re-use the{' '}
        <code>repo</code> write story &mdash; it only backs up a small json
        document to a private gist in your account, as that feature describes
        in settings.
      </Text>
      <Title order={2}>your sign-in token</Title>
      <Text>
        after login, your oauth access token stays only in persistent storage for this site in your
        browser. we need it so every graphql call is signed as you. we do not have a server that
        stores it; closing the tab does not revoke it until you log out or clear site data for this
        origin.
      </Text>
      <Title order={2}>what gitInsights keeps on this device</Title>
      <List spacing="xs" size="sm" type="ordered">
        <List.Item>
          settings you touch — pto, holidays, tile layout, theme, and the rest of the settings area.
        </List.Item>
        <List.Item>
          saved github responses so the dashboard still paints when the network flakes or you come
          back tomorrow.
        </List.Item>
        <List.Item>
          small prefs for sync, install identity for sync logs, and a few ui flags — all under the
          same gitInsights namespace so one logout sweep clears them.
        </List.Item>
      </List>
      <Title order={2}>analytics</Title>
      <Text>
        every chart, heatmap, wlb audit, and commit momentum score is computed on this device
        (workers included). nothing is shipped to our analytics product because we do not run one.
        if you do not trust that, open devtools and watch the network tab — you should see github and
        the token proxy, full stop.
      </Text>
      <Title order={2}>optional sync</Title>
      <Text>
        if you turn on sync, we write a private gist named{' '}
        <code>gi.user-data.json</code> to your github account. that gist holds a
        json export of your settings blob. we never see the contents — the token
        on this device does the read/write. deleting the gist from github is on
        you; the app also offers &quot;delete cloud copy&quot; inside settings.
      </Text>
      <Title order={2}>how to wipe everything here</Title>
      <List spacing="xs" size="sm">
        <List.Item>
          hit <strong>log out</strong> in the header. that removes gitInsights&apos; saved sign-in,
          dashboard fetch snapshots, and settings stored for this site. we leave a tiny random install
          id behind so sync logs stay honest if you sign back in; it holds no account data.
        </List.Item>
        <List.Item>
          want a totally clean slate? after logout, use your browser&apos;s &quot;clear site data&quot;
          control for this origin, or remove stored data for this site by hand.
        </List.Item>
        <List.Item>
          revoke the oauth app anytime so old tokens die:{' '}
          <Anchor href={REVOKE_APPS} target="_blank" rel="noreferrer" underline="always">
            github.com/settings/applications
          </Anchor>
          .
        </List.Item>
      </List>
    </Stack>
  );
}
