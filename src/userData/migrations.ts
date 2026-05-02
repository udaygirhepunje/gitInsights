import {
  CURRENT_SCHEMA_VERSION,
  EPOCH_TIMESTAMP,
  cloneDefaultUserData,
  type Preferences,
  type UserData,
} from './schema';

// Dispatch table for forward-only schema migrations. Each entry takes the doc
// at version `n` and returns a doc at version `n + 1`.
type Migration = (input: unknown) => unknown;

const MIGRATIONS: Record<number, Migration> = {
  // v1 → v2 (Phase 5b): add `updatedAt` and `lastWriterDeviceId` for sync.
  1: (input) => ({
    ...(input as object),
    schemaVersion: 2,
    updatedAt: EPOCH_TIMESTAMP,
    lastWriterDeviceId: '',
  }),
  // v2 → v3 (Phase 9): `preferences` becomes a typed bag; initialise
  // `timeframe` to the default so the hook never needs a fallback branch.
  2: (input) => {
    const doc = input as Record<string, unknown>;
    const existing = (doc.preferences ?? {}) as Record<string, unknown>;
    return {
      ...doc,
      schemaVersion: 3,
      preferences: {
        ...existing,
        timeframe: existing['timeframe'] ?? { kind: 'preset', preset: 'last-year' },
      },
    };
  },
  // v3 → v4 (Phase 11): schema bump; default timeframe for new installs is
  // last-30-days via `schema.ts`. Existing stored `preferences.timeframe` is preserved.
  3: (input) => ({
    ...(input as object),
    schemaVersion: 4,
  }),
};

export type MigrationResult = {
  data: UserData;
  migrated: boolean;
  fromVersion: number;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readVersion(input: unknown): number {
  if (!isObject(input)) return 0;
  const v = input.schemaVersion;
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export function migrateUserData(input: unknown): MigrationResult {
  const fromVersion = readVersion(input);

  if (!isObject(input) || fromVersion === 0) {
    return { data: cloneDefaultUserData(), migrated: false, fromVersion: 0 };
  }

  if (fromVersion > CURRENT_SCHEMA_VERSION) {
    throw new MigrationError(
      `unrecognized user-data version ${fromVersion}. you're on a newer build than this app.`,
      fromVersion,
    );
  }

  let cursor: unknown = input;
  let version = fromVersion;
  while (version < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) {
      throw new MigrationError(`missing migration step for v${version}`, version);
    }
    cursor = step(cursor);
    version += 1;
  }

  return {
    data: hydrateDefaults(cursor),
    migrated: fromVersion < CURRENT_SCHEMA_VERSION,
    fromVersion,
  };
}

function hydrateDefaults(input: unknown): UserData {
  const defaults = cloneDefaultUserData();
  if (!isObject(input)) return defaults;
  const partial = input as Partial<UserData>;
  const merged: UserData = {
    ...defaults,
    ...partial,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    updatedAt: typeof partial.updatedAt === 'string' ? partial.updatedAt : defaults.updatedAt,
    lastWriterDeviceId:
      typeof partial.lastWriterDeviceId === 'string'
        ? partial.lastWriterDeviceId
        : defaults.lastWriterDeviceId,
    workweek: {
      workdays:
        Array.isArray(partial.workweek?.workdays) && (partial.workweek?.workdays?.length ?? 0) > 0
          ? (partial.workweek!.workdays as number[])
          : defaults.workweek.workdays,
    },
    pto: Array.isArray(partial.pto) ? (partial.pto as UserData['pto']) : defaults.pto,
    holidays: {
      regions: Array.isArray(partial.holidays?.regions)
        ? (partial.holidays!.regions as string[])
        : defaults.holidays.regions,
      overrides: Array.isArray(partial.holidays?.overrides)
        ? (partial.holidays!.overrides as UserData['holidays']['overrides'])
        : defaults.holidays.overrides,
    },
    bento: {
      tileOrder: Array.isArray(partial.bento?.tileOrder)
        ? (partial.bento!.tileOrder as string[])
        : defaults.bento.tileOrder,
      hiddenTiles: Array.isArray(partial.bento?.hiddenTiles)
        ? (partial.bento!.hiddenTiles as string[])
        : defaults.bento.hiddenTiles,
    },
    preferences: mergePreferences(partial.preferences, defaults.preferences),
  };
  return merged;
}

function mergePreferences(raw: unknown, defaults: Preferences): Preferences {
  if (!isObject(raw)) return defaults;
  const p = raw as Record<string, unknown>;
  return {
    ...defaults,
    ...(p['timeframe'] !== undefined ? { timeframe: p['timeframe'] as Preferences['timeframe'] } : {}),
  };
}

export class MigrationError extends Error {
  readonly fromVersion: number;

  constructor(message: string, fromVersion: number) {
    super(message);
    this.name = 'MigrationError';
    this.fromVersion = fromVersion;
  }
}
