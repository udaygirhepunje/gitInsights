// Schema for the `gi.user-data` IndexedDB doc (spec §3.F, §3.G).
// One source of truth for everything the user can configure: theme, workweek,
// streak mode, PTO, holidays, bento layout, and a forward-compatible bag.
//
// `schemaVersion` MUST be bumped whenever a backward-incompatible change is
// made; add an entry to the migrations dispatch table in `migrations.ts`.

export type ThemeChoice = 'system' | 'dark' | 'light';

// Phase 9 — §3.F, §6 Global Timeframe Filter.
export type PresetId =
  | 'last-week'
  | 'last-30-days'
  | 'last-3-months'
  | 'last-6-months'
  | 'last-year';

export type Timeframe =
  | { kind: 'preset'; preset: PresetId }
  | { kind: 'month'; year: number; month: number }
  | { kind: 'quarter'; year: number; quarter: 1 | 2 | 3 | 4 }
  | { kind: 'custom'; from: string; to: string };

export const DEFAULT_TIMEFRAME: Timeframe = { kind: 'preset', preset: 'last-30-days' };

export type Preferences = {
  timeframe?: Timeframe;
};

export type StreakMode = 'strict' | 'skip-non-workdays' | 'workdays-only';

export type PtoKind = 'vacation' | 'sick' | 'holiday' | 'other';

export type PtoEntry = {
  date: string;
  label?: string;
  kind?: PtoKind;
};

export type HolidayOverride = {
  date: string;
  treatAs: 'workday';
};

export type HolidaysConfig = {
  regions: string[];
  overrides: HolidayOverride[];
};

export type Workweek = {
  workdays: number[];
};

export type BentoConfig = {
  tileOrder: string[];
  hiddenTiles: string[];
};

export type UserData = {
  schemaVersion: 4;
  // ISO 8601 timestamp of the last write. Drives last-write-wins conflict
  // resolution for cross-device sync (spec §3.G). Always stamped by the
  // store; never trust callers to set it.
  updatedAt: string;
  // Stable per-device UUID of whoever wrote the doc last. Used by the sync
  // log so users can tell "this was me on the laptop" from "this was me on
  // the phone". Local-only; the device id itself never syncs.
  lastWriterDeviceId: string;
  theme: ThemeChoice;
  workweek: Workweek;
  streakMode: StreakMode;
  pto: PtoEntry[];
  holidays: HolidaysConfig;
  bento: BentoConfig;
  preferences: Preferences;
};

export const CURRENT_SCHEMA_VERSION = 4 as const;

export const EPOCH_TIMESTAMP = '1970-01-01T00:00:00.000Z';

export const DEFAULT_USER_DATA: UserData = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  updatedAt: EPOCH_TIMESTAMP,
  lastWriterDeviceId: '',
  theme: 'system',
  workweek: { workdays: [1, 2, 3, 4, 5] },
  streakMode: 'skip-non-workdays',
  pto: [],
  holidays: { regions: [], overrides: [] },
  bento: { tileOrder: [], hiddenTiles: [] },
  preferences: { timeframe: DEFAULT_TIMEFRAME },
};

export function cloneDefaultUserData(): UserData {
  return {
    ...DEFAULT_USER_DATA,
    workweek: { workdays: [...DEFAULT_USER_DATA.workweek.workdays] },
    pto: [],
    holidays: { regions: [], overrides: [] },
    bento: { tileOrder: [], hiddenTiles: [] },
    preferences: { timeframe: DEFAULT_TIMEFRAME },
  };
}
