import { Anchor, Button, Group, Stack, Text } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { deleteAllChunks } from '../../api/commitCache';
import { clearAllQueryCache } from '../../api/queryClient';
import { useAuth } from '../../hooks/useAuth';
import { useSyncStore } from '../../sync';
import { ConfirmDialog } from './ConfirmDialog';
import { SettingsSection } from './SettingsSection';

const REVOKE_URL = 'https://github.com/settings/applications';

export function DataControlsSection(): JSX.Element {
  const { logout, viewer } = useAuth();
  const queryClient = useQueryClient();
  const syncEnabled = useSyncStore((s) => s.enabled);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [pendingClearCache, setPendingClearCache] = useState(false);
  const [pendingRefreshCommits, setPendingRefreshCommits] = useState(false);
  const [pendingLogout, setPendingLogout] = useState(false);

  const handleClearCache = async () => {
    await clearAllQueryCache();
    if (viewer?.login) await deleteAllChunks(viewer.login);
    void queryClient.invalidateQueries({
      predicate: (q) => {
        const key = q.queryKey;
        return (
          Array.isArray(key) && key[0] === 'viewer' && key[1] === 'commitsByDay' && key[2] === viewer?.login
        );
      },
    });
    setStatus({
      tone: 'success',
      message:
        'saved github responses and commit rollups cleared on this device. next load pulls fresh from github.',
    });
  };

  const handleRefreshCommits = async () => {
    const login = viewer?.login;
    if (!login) return;
    try {
      await deleteAllChunks(login);
      await queryClient.invalidateQueries({
        predicate: (q) => {
          const key = q.queryKey;
          return (
            Array.isArray(key) && key[0] === 'viewer' && key[1] === 'commitsByDay' && key[2] === login
          );
        },
      });
      setStatus({
        tone: 'success',
        message:
          'refreshing commit data from github. give it a few minutes — the heatmap will fill back in.',
      });
    } catch {
      setStatus({ tone: 'error', message: "couldn't clear commit chunks. try again." });
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.assign('/');
  };

  return (
    <SettingsSection
      id="data"
      title="account"
      description="saved dashboard data on this device, session, and your github sign-in."
    >
      <Stack gap="sm">
        <Group gap="sm" wrap="wrap">
          <Button variant="outline" color="primerRed" onClick={() => setPendingClearCache(true)}>
            clear saved github data
          </Button>
          <Button variant="outline" color="primerYellow" onClick={() => setPendingRefreshCommits(true)}>
            refresh all commit data
          </Button>
          <Button variant="filled" color="primerRed" onClick={() => setPendingLogout(true)}>
            log out
          </Button>
        </Group>
        <Anchor c="primerYellow" href={REVOKE_URL} target="_blank" rel="noreferrer" size="sm">
          revoke gitInsights’ github authorization (opens github)
        </Anchor>
        {status ? (
          <Text size="sm" c={status.tone === 'success' ? 'dimmed' : 'primerRed'}>
            {status.message}
          </Text>
        ) : null}
      </Stack>

      <ConfirmDialog
        opened={pendingClearCache}
        title="clear saved github data?"
        body="drops stored commits, repo metadata, and computed tiles from this device. next dashboard load talks to github again. settings (theme, pto, holidays) stay."
        confirmLabel="clear saved data"
        onCancel={() => setPendingClearCache(false)}
        onConfirm={() => {
          setPendingClearCache(false);
          void handleClearCache();
        }}
      />

      <ConfirmDialog
        opened={pendingRefreshCommits}
        title="refresh all commit data?"
        body="re-downloads your commit history from github. takes a few minutes. only do this if something looks wrong."
        confirmLabel="refresh commits"
        onCancel={() => setPendingRefreshCommits(false)}
        onConfirm={() => {
          setPendingRefreshCommits(false);
          void handleRefreshCommits();
        }}
      />

      <ConfirmDialog
        opened={pendingLogout}
        title="log out?"
        body={
          syncEnabled
            ? 'wipes your session and everything gitInsights saved on this device. sync is on, so your settings come back when you log in again. cloud copy stays on github.'
            : 'wipes your session and everything gitInsights saved on this device. sync is off, so your settings (theme, pto, holidays, bento) will be gone. export first or turn on sync if you want them back.'
        }
        confirmLabel="log out"
        onCancel={() => setPendingLogout(false)}
        onConfirm={() => {
          setPendingLogout(false);
          void handleLogout();
        }}
      />
    </SettingsSection>
  );
}
