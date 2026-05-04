import { Divider, Stack, Text, Title } from '@mantine/core';

import { DataControlsSection } from '../components/Settings/DataControlsSection';
import { PtoCalendarSection } from '../components/Settings/PtoCalendarSection';
import { PublicHolidaysSection } from '../components/Settings/PublicHolidaysSection';
import { StreakModeSection } from '../components/Settings/StreakModeSection';
import { SyncSection } from '../components/Settings/SyncSection';
import { ThemeSection } from '../components/Settings/ThemeSection';
import { WorkweekSection } from '../components/Settings/WorkweekSection';

export function SettingsPage(): JSX.Element {
  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Title order={1}>settings</Title>
        <Text c="dimmed">
          everything below stays on this device unless you turn on cross-device sync.
        </Text>
      </Stack>

      <ThemeSection />
      <Divider variant="dashed" />
      <WorkweekSection />
      <Divider variant="dashed" />
      <StreakModeSection />
      <Divider variant="dashed" />
      <PtoCalendarSection />
      <Divider variant="dashed" />
      <PublicHolidaysSection />
      <Divider variant="dashed" />
      <SyncSection />
      <Divider variant="dashed" />
      <DataControlsSection />
    </Stack>
  );
}
