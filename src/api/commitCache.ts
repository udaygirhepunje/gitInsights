// Month-chunked commit cache for GET /search/commits (spec §3.D.1, Phase 11).
import { clear, createStore, del, get, keys, set } from 'idb-keyval';

const DB_NAME = 'gi.commits';
const STORE_NAME = 'chunks';

const idbStore = createStore(DB_NAME, STORE_NAME);

export type MonthChunk = {
  month: string;
  login: string;
  byDate: Record<string, number>;
  timestamps: string[];
  fetchedAt: string;
  sealed: boolean;
  truncated: boolean;
};

function chunkKey(login: string, month: string): string {
  return `v1:${login}:${month}`;
}

/** Month ended more than 30 days ago — never auto-refetch (spec §3.D.1). */
export function isMonthSealed(monthKey: string, now = new Date()): boolean {
  const parts = monthKey.split('-').map(Number);
  const y = parts[0];
  const m = parts[1];
  if (y === undefined || m === undefined || m < 1 || m > 12) return false;
  const lastDay = new Date(y, m, 0);
  lastDay.setHours(23, 59, 59, 999);
  const cutoff = new Date(lastDay);
  cutoff.setDate(cutoff.getDate() + 30);
  return cutoff.getTime() < now.getTime();
}

export async function getChunk(login: string, month: string): Promise<MonthChunk | null> {
  const row = await get<MonthChunk>(chunkKey(login, month), idbStore);
  return row ?? null;
}

export async function setChunk(chunk: MonthChunk): Promise<void> {
  await set(chunkKey(chunk.login, chunk.month), chunk, idbStore);
}

export async function deleteAllChunks(login: string): Promise<void> {
  const all = await keys<string>(idbStore);
  const prefix = `v1:${login}:`;
  await Promise.all(all.filter((k) => k.startsWith(prefix)).map((k) => del(k, idbStore)));
}

/** Sorted ascending YYYY-MM. */
export async function listCachedMonths(login: string): Promise<string[]> {
  const all = await keys<string>(idbStore);
  const prefix = `v1:${login}:`;
  const months = all
    .filter((k) => k.startsWith(prefix))
    .map((k) => k.slice(prefix.length))
    .filter((m) => /^\d{4}-\d{2}$/.test(m));
  months.sort();
  return months;
}

export async function clearCommitCacheStore(): Promise<void> {
  try {
    await clear(idbStore);
  } catch {
    // best-effort
  }
}
