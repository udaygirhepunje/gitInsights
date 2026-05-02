import { describe, expect, it } from 'vitest';

import { migrateUserData, MigrationError } from '../migrations';
import { CURRENT_SCHEMA_VERSION } from '../schema';

describe('migrateUserData', () => {
  it('returns defaults when input is missing or non-object', () => {
    const result = migrateUserData(undefined);
    expect(result.fromVersion).toBe(0);
    expect(result.migrated).toBe(false);
    expect(result.data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.data.workweek.workdays).toEqual([1, 2, 3, 4, 5]);
  });

  it('passes through current-version docs unchanged', () => {
    const doc = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      theme: 'dark' as const,
      workweek: { workdays: [1, 2, 3] },
      streakMode: 'workdays-only' as const,
      pto: [{ date: '2026-01-01', kind: 'vacation' as const }],
      holidays: { regions: ['US'], overrides: [] },
      bento: { tileOrder: [], hiddenTiles: [] },
      preferences: { timeframe: { kind: 'preset' as const, preset: 'last-30-days' as const } },
      updatedAt: '2026-01-01T00:00:00.000Z',
      lastWriterDeviceId: 'test',
    };
    const result = migrateUserData(doc);
    expect(result.migrated).toBe(false);
    expect(result.data.theme).toBe('dark');
    expect(result.data.workweek.workdays).toEqual([1, 2, 3]);
    expect(result.data.holidays.regions).toEqual(['US']);
  });

  it('rejects future schema versions', () => {
    expect(() =>
      migrateUserData({ schemaVersion: 999, theme: 'dark' }),
    ).toThrow(MigrationError);
  });

  it('hydrates missing fields with defaults', () => {
    const partial = { schemaVersion: 3, theme: 'light' as const };
    const result = migrateUserData(partial);
    expect(result.data.theme).toBe('light');
    expect(result.data.workweek.workdays).toEqual([1, 2, 3, 4, 5]);
    expect(result.data.holidays.regions).toEqual([]);
    expect(result.data.preferences.timeframe).toEqual({ kind: 'preset', preset: 'last-30-days' });
  });

  it('migrates v1 docs forward by adding sync metadata fields', () => {
    const v1 = {
      schemaVersion: 1,
      theme: 'dark' as const,
      workweek: { workdays: [1, 2, 3, 4, 5] },
      streakMode: 'strict' as const,
      pto: [],
      holidays: { regions: [], overrides: [] },
      bento: { tileOrder: [], hiddenTiles: [] },
      preferences: {},
    };
    const result = migrateUserData(v1);
    expect(result.migrated).toBe(true);
    expect(result.fromVersion).toBe(1);
    expect(result.data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(typeof result.data.updatedAt).toBe('string');
    expect(result.data.lastWriterDeviceId).toBe('');
    expect(result.data.theme).toBe('dark');
  });

  it('migrates v2 → v3 (Phase 9): sets default timeframe in preferences', () => {
    const v2 = {
      schemaVersion: 2,
      theme: 'light' as const,
      workweek: { workdays: [1, 2, 3, 4, 5] },
      streakMode: 'skip-non-workdays' as const,
      pto: [],
      holidays: { regions: [], overrides: [] },
      bento: { tileOrder: [], hiddenTiles: [] },
      preferences: {},
      updatedAt: '2026-01-01T00:00:00.000Z',
      lastWriterDeviceId: 'test-device',
    };
    const result = migrateUserData(v2);
    expect(result.migrated).toBe(true);
    expect(result.fromVersion).toBe(2);
    expect(result.data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.data.preferences.timeframe).toEqual({ kind: 'preset', preset: 'last-year' });
  });

  it('migrates v2 → v3: preserves existing timeframe if already set', () => {
    const v2 = {
      schemaVersion: 2,
      theme: 'dark' as const,
      workweek: { workdays: [1, 2, 3, 4, 5] },
      streakMode: 'skip-non-workdays' as const,
      pto: [],
      holidays: { regions: [], overrides: [] },
      bento: { tileOrder: [], hiddenTiles: [] },
      preferences: { timeframe: { kind: 'preset', preset: 'last-30-days' } },
      updatedAt: '2026-01-01T00:00:00.000Z',
      lastWriterDeviceId: 'test-device',
    };
    const result = migrateUserData(v2);
    expect(result.data.preferences.timeframe).toEqual({ kind: 'preset', preset: 'last-30-days' });
  });

  it('migrates v3 → v4 (Phase 11): bumps schema only; keeps timeframe', () => {
    const v3 = {
      schemaVersion: 3,
      theme: 'light' as const,
      workweek: { workdays: [1, 2, 3, 4, 5] },
      streakMode: 'skip-non-workdays' as const,
      pto: [],
      holidays: { regions: [], overrides: [] },
      bento: { tileOrder: [], hiddenTiles: [] },
      preferences: { timeframe: { kind: 'preset' as const, preset: 'last-year' as const } },
      updatedAt: '2026-01-01T00:00:00.000Z',
      lastWriterDeviceId: 'x',
    };
    const result = migrateUserData(v3);
    expect(result.migrated).toBe(true);
    expect(result.fromVersion).toBe(3);
    expect(result.data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.data.preferences.timeframe).toEqual({ kind: 'preset', preset: 'last-year' });
  });
});
